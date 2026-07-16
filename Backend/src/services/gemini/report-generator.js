const crypto = require("node:crypto")
const { buildCandidateContext } = require("./context-builder")
const { generateJson } = require("./gemini-client")
const {
  buildCoreReportPrompt,
  buildResumeBuilderPrompt,
  buildQuestionSetPrompt,
  buildRoadmapAndResumePrompt
} = require("./prompt-builder")
const { validateReport, validateSection } = require("./response-validator")
const { GenerationStepError, logFailure, logStep } = require("./errors")
const { logPipelineSnapshot } = require("./pipeline-snapshot")

const contextCache = new Map()
const DEFAULT_STAGE_CONCURRENCY = 2

function stageConcurrency() {
  const configured = Number(process.env.GEMINI_STAGE_CONCURRENCY || DEFAULT_STAGE_CONCURRENCY)
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 4) : DEFAULT_STAGE_CONCURRENCY
}

function profileStageStart(requestId, stage, totalStartedAt) {
  const startedAt = Date.now()
  logStep("performance", `[START] ${stage}`, {
    requestId,
    stage,
    startTime: new Date(startedAt).toISOString(),
    totalElapsedMs: startedAt - totalStartedAt
  })
  return startedAt
}

function profileStageEnd(requestId, stage, startedAt, totalStartedAt, status, extra = {}) {
  const endedAt = Date.now()
  logStep("performance", `[END] ${stage}`, {
    requestId,
    stage,
    status,
    endTime: new Date(endedAt).toISOString(),
    elapsedMs: endedAt - startedAt,
    totalElapsedMs: endedAt - totalStartedAt,
    ...extra
  })
}

function estimateTokens(value = "") {
  return Math.ceil(String(value || "").length / 4)
}

function contextCacheKey({ resume = "", selfDescription = "", jobDescription = "", user = {} }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      resume,
      selfDescription,
      jobDescription,
      userId: user.id || user._id || "",
      username: user.username || user.name || "",
      email: user.email || ""
    }))
    .digest("hex")
}

function getCachedContext(input) {
  const key = contextCacheKey(input)
  const cached = contextCache.get(key)
  if (cached) return cached

  const context = buildCandidateContext(input)
  contextCache.set(key, context)
  if (contextCache.size > 20) {
    const [oldestKey] = contextCache.keys()
    contextCache.delete(oldestKey)
  }
  return context
}

function createRequestId() {
  return `gen_${crypto.randomUUID().slice(0, 8)}`
}

function pick(raw, key) {
  if (!key) return raw
  if (raw && Object.prototype.hasOwnProperty.call(raw, key)) return raw[key]
  return raw
}

async function runStageQueue(tasks, { requestId, concurrency = stageConcurrency() } = {}) {
  const results = {}
  const entries = Object.entries(tasks)
  let nextIndex = 0

  async function worker(workerId) {
    while (nextIndex < entries.length) {
      const [key, task] = entries[nextIndex]
      nextIndex += 1

      logStep("stage-queue", "Queued stage started", {
        requestId,
        workerId,
        stage: key,
        concurrency
      })

      results[key] = await task()

      logStep("stage-queue", "Queued stage completed", {
        requestId,
        workerId,
        stage: key
      })
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, entries.length) }, (_, index) => worker(index + 1))
  )

  return results
}

async function generateStage({
  requestId,
  stage,
  sectionKey,
  promptBuilder,
  validate,
  timeoutMs = 90000,
  providerRetries = 4,
  validationAttempts = 2,
  totalStartedAt = Date.now(),
  onProgress
}) {
  let feedback = ""
  let lastError = null

  for (let attempt = 0; attempt < validationAttempts; attempt += 1) {
    const startedAt = Date.now()
    const prompt = promptBuilder(feedback)
    const promptChars = prompt.length
    const promptTokens = estimateTokens(prompt)

    try {
      logStep("performance", `[START] ${stage}`, {
        requestId,
        stage,
        startTime: new Date(startedAt).toISOString(),
        validationAttempt: attempt + 1,
        totalElapsedMs: startedAt - totalStartedAt,
        promptChars,
        estimatedPromptTokens: promptTokens
      })
      logStep(stage, "Stage generation started", {
        requestId,
        stage,
        validationAttempt: attempt + 1,
        timeoutMs,
        promptChars,
        estimatedPromptTokens: promptTokens
      })

      const raw = await generateJson({
        prompt,
        step: stage,
        timeoutMs,
        maxRetries: providerRetries,
        requestId,
        onRetry: onProgress
      })
      logPipelineSnapshot(`${stage}:after-json-parse`, raw, {
        requestId,
        validationAttempt: attempt + 1,
        promptChars,
        estimatedPromptTokens: promptTokens
      })
      const validationInput = pick(raw, sectionKey)
      logPipelineSnapshot(`${stage}:before-response-validator`, validationInput, {
        requestId,
        validationAttempt: attempt + 1
      })
      const value = validate(validationInput)
      logPipelineSnapshot(`${stage}:after-response-validator`, value, {
        requestId,
        validationAttempt: attempt + 1
      })
      const outputJson = JSON.stringify(value || {})

      logStep(stage, "Stage generation completed", {
        requestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        responseChars: outputJson.length,
        estimatedResponseTokens: estimateTokens(outputJson)
      })
      profileStageEnd(requestId, stage, startedAt, totalStartedAt, "SUCCESS", {
        validationAttempt: attempt + 1,
        promptChars,
        estimatedPromptTokens: promptTokens,
        outputChars: outputJson.length,
        estimatedOutputTokens: estimateTokens(outputJson)
      })

      return value
    } catch (error) {
      lastError = error
      feedback = error.details || error.reason || error.message
      profileStageEnd(requestId, stage, startedAt, totalStartedAt, "FAILED", {
        validationAttempt: attempt + 1,
        errorName: error?.name,
        errorMessage: error?.message || error?.reason
      })
      logFailure(stage, error, {
        requestId,
        stage,
        validationAttempt: attempt + 1,
        elapsedMs: Date.now() - startedAt
      })

      const canRegenerateStage = error instanceof GenerationStepError &&
        (error.step?.startsWith("response-validator") || error.step?.includes(":parse"))

      if (error.retryable === false && !canRegenerateStage) {
        throw error
      }
    }
  }

  throw lastError || new GenerationStepError({
    step: stage,
    reason: `${stage} failed.`,
    retryable: false
  })
}

function mergeReport({ context, jobSection, technicalQuestions, behavioralQuestions, resumeQuestions, strategy, roadmap, atsSection, resumeBuilder, generationWarnings = [] }) {
  const atsAnalysis = atsSection.atsAnalysis || {}
  const resumeSuggestions = atsSection.resumeSuggestions || []

  return {
    title: jobSection.title || `${jobSection.jobAnalysis?.jobTitle || "Interview"} Strategy`,
    jobTitle: jobSection.jobTitle || jobSection.jobAnalysis?.jobTitle || "",
    company: jobSection.company || "",
    jobAnalysis: jobSection.jobAnalysis || {},
    matchScore: jobSection.matchScore,
    technicalQuestions,
    behavioralQuestions,
    resumeQuestions,
    skillGaps: jobSection.skillGaps || [],
    strategy,
    roadmap,
    preparationPlan: roadmap,
    atsAnalysis,
    resumeBuilder,
    resumeSuggestions,
    generationWarnings,
    generatedContext: {
      candidateName: context.candidate?.name || "",
      generatedAt: context.generatedAt
    }
  }
}

function validateCoreReport(rawValue = {}) {
  const raw = rawValue?.jobAnalysis ? rawValue : { jobAnalysis: rawValue }

  return {
    title: raw.title || "",
    jobTitle: raw.jobTitle || raw.jobAnalysis?.jobTitle || "",
    company: raw.company || "",
    matchScore: raw.matchScore,
    jobAnalysis: validateSection("jobAnalysis", raw.jobAnalysis || {}),
    skillGaps: validateSection("skillGaps", raw.skillGaps || []),
    atsSection: {
      atsAnalysis: validateSection("atsAnalysis", raw.atsAnalysis || {}),
      resumeSuggestions: validateSection("resumeSuggestions", raw.resumeSuggestions || [])
    },
    strategy: validateSection("strategy", raw.strategy || {})
  }
}

function validateRoadmapAndResume(rawValue = {}) {
  return {
    roadmap: validateSection("roadmap", rawValue?.roadmap || rawValue || []),
    resumeBuilder: validateSection("resumeBuilder", rawValue?.resumeBuilder || {})
  }
}

function validateQuestionSet(rawValue = {}) {
  return {
    technicalQuestions: validateSection("technicalQuestions", rawValue?.technicalQuestions || []),
    behavioralQuestions: validateSection("behavioralQuestions", rawValue?.behavioralQuestions || []),
    resumeQuestions: validateSection("resumeQuestions", rawValue?.resumeQuestions || [])
  }
}

async function generateInterviewReport({ resume = "", selfDescription = "", jobDescription = "", user = {}, onProgress }) {
  const totalStartedAt = Date.now()
  const requestId = createRequestId()
  const contextStartedAt = profileStageStart(requestId, "Candidate Context", totalStartedAt)
  const context = getCachedContext({ resume, selfDescription, jobDescription, user })
  profileStageEnd(requestId, "Candidate Context", contextStartedAt, totalStartedAt, "SUCCESS", {
    resumeChars: context.candidate.resumeText.length,
    candidateSource: context.candidate.sourceType,
    selfDescriptionChars: context.candidate.selfDescription.length,
    candidateSummaryChars: context.candidate.analysis?.summary?.length || 0,
    jobDescriptionChars: context.jobDescription.length
  })

  logStep("report-generator", "Candidate context built", {
    requestId,
    resumeChars: context.candidate.resumeText.length,
    candidateSource: context.candidate.sourceType,
    candidateSkills: context.candidate.analysis?.skills || [],
    jobDescriptionChars: context.jobDescription.length,
    hasCandidateName: Boolean(context.candidate.name)
  })

  logStep("report-generator", "Generation queue configured", {
    requestId,
    concurrency: stageConcurrency(),
    plannedContentRequests: 3,
    parallelStages: ["question-set", "roadmap-resume-builder"]
  })

  const coreStartedAt = profileStageStart(requestId, "Core Report", totalStartedAt)
  const core = await generateStage({
    requestId,
    stage: "core-report",
    sectionKey: null,
    timeoutMs: 120000,
    promptBuilder: (feedback) => buildCoreReportPrompt(context, feedback),
    validate: validateCoreReport,
    onProgress,
    totalStartedAt
  })
  profileStageEnd(requestId, "Core Report", coreStartedAt, totalStartedAt, "SUCCESS")

  const queued = await runStageQueue({
    questionSet: () => generateStage({
      requestId,
      stage: "question-set",
      sectionKey: null,
      timeoutMs: 180000,
      promptBuilder: (feedback) => buildQuestionSetPrompt(context, core.jobAnalysis, feedback),
      validate: validateQuestionSet,
      onProgress,
      totalStartedAt
    }),
    roadmapAndResume: () => generateStage({
      requestId,
      stage: "roadmap-resume-builder",
      sectionKey: null,
      timeoutMs: 120000,
      promptBuilder: (feedback) => buildRoadmapAndResumePrompt(context, core.jobAnalysis, core.strategy, core.atsSection.atsAnalysis, true, feedback),
      validate: validateRoadmapAndResume,
      onProgress,
      totalStartedAt
    })
  }, { requestId, concurrency: stageConcurrency() })

  const roadmap = queued.roadmapAndResume.roadmap
  let resumeBuilder = queued.roadmapAndResume.resumeBuilder
  const generationWarnings = []

  const mergeStartedAt = profileStageStart(requestId, "Merge And Validate Report", totalStartedAt)
  const merged = mergeReport({
    context,
    jobSection: core,
    technicalQuestions: queued.questionSet.technicalQuestions,
    behavioralQuestions: queued.questionSet.behavioralQuestions,
    resumeQuestions: queued.questionSet.resumeQuestions,
    strategy: core.strategy,
    roadmap,
    atsSection: core.atsSection,
    resumeBuilder,
    generationWarnings
  })
  logPipelineSnapshot("report-generator:after-merge", merged, { requestId })
  logPipelineSnapshot("report-generator:before-final-validation", merged, { requestId })
  const report = validateReport(merged, context)
  logPipelineSnapshot("report-generator:after-final-validation", report, { requestId })
  profileStageEnd(requestId, "Merge And Validate Report", mergeStartedAt, totalStartedAt, "SUCCESS")

  logStep("report-generator", "Sectioned report generation completed", {
    requestId,
    technicalQuestions: report.technicalQuestions.length,
    behavioralQuestions: report.behavioralQuestions.length,
    resumeQuestions: report.resumeQuestions.length,
    roadmapDays: report.roadmap.length,
    warnings: generationWarnings.length
  })
  profileStageEnd(requestId, "Interview Generation Total", totalStartedAt, totalStartedAt, "SUCCESS", {
    totalRequestTimeMs: Date.now() - totalStartedAt,
    geminiApiCalls: 3,
    stagesParallelized: ["question-set", "roadmap-resume-builder"]
  })

  return report
}

async function generateResumeBuilderSection({ context, jobAnalysis = {}, atsAnalysis = {}, requestId = createRequestId() }) {
  return generateStage({
    requestId,
    stage: "resume-builder",
    sectionKey: "resumeBuilder",
    timeoutMs: 75000,
    promptBuilder: (feedback) => buildResumeBuilderPrompt(context, jobAnalysis, atsAnalysis, feedback),
    validate: (rawValue) => validateSection("resumeBuilder", rawValue)
  })
}

async function regenerateResumeBuilder({ resume = "", selfDescription = "", jobDescription = "", user = {}, jobAnalysis = {}, atsAnalysis = {} }) {
  const requestId = createRequestId()
  const context = getCachedContext({ resume, selfDescription, jobDescription, user })
  return generateResumeBuilderSection({
    context,
    jobAnalysis,
    atsAnalysis,
    requestId
  })
}

module.exports = {
  generateInterviewReport,
  regenerateResumeBuilder
}
