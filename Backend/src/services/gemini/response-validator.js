const { normalizeAtsResumeData } = require("./ats-generator")
const { GenerationStepError, logStep } = require("./errors")

const QUESTION_COUNTS = {
  technicalQuestions: 20,
  behavioralQuestions: 10,
  resumeQuestions: 10
}

const STRATEGY_KEYS = [
  "importantTopics",
  "frequentlyAskedAreas",
  "skillsToStrengthen",
  "commonMistakes",
  "salaryNegotiationTips",
  "interviewTips",
  "finalChecklist",
  "topicsToPrioritize",
  "topicsSafeToSkip",
  "likelyInterviewRounds",
  "preparationOrder",
  "timeAllocation",
  "companyExpectations",
  "highImpactConcepts",
  "mostProbableQuestions",
  "commonRejectionReasons",
  "finalInterviewTips",
  "roadmapImmediate",
  "roadmapOneWeek",
  "roadmapTwoWeeks",
  "roadmapOneMonth",
  "roadmapAdvanced",
  "interviewReadyChecklist",
  "freeLearningResources",
  "priorityCritical",
  "priorityHigh",
  "priorityMedium",
  "priorityLow"
]

function asString(value = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of [
      "text",
      "value",
      "label",
      "name",
      "title",
      "skill",
      "keyword",
      "summary",
      "description",
      "reason",
      "answer",
      "idealAnswer",
      "excellentAnswer",
      "goodAnswer",
      "content",
      "details"
    ]) {
      if (value[key]) return asString(value[key])
    }

    try {
      return JSON.stringify(value)
    } catch {
      return ""
    }
  }
  return typeof value === "string" ? value.trim() : String(value || "").trim()
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === "") return []
  return [value]
}

function stringArray(value) {
  return asArray(value)
    .flatMap((item) => Array.isArray(item) ? stringArray(item) : [asString(item)])
    .filter(Boolean)
}

function numberInRange(value, fallback = 0, min = 0, max = 100) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function compact(value = "") {
  return asString(value).replace(/\s+/g, " ")
}

function normalizeDifficulty(value = "") {
  const normalized = asString(value).toLowerCase()
  return ["beginner", "intermediate", "advanced"].includes(normalized)
    ? normalized
    : "intermediate"
}

function labeledList(label, value) {
  return stringArray(value).map((item) => `${label}: ${item}`)
}

function firstString(...values) {
  for (const value of values) {
    const text = asString(value)
    if (text) return text
  }

  return ""
}

function joinStar(star = {}) {
  return [
    star?.situation ? `Situation: ${asString(star.situation)}` : "",
    star?.task ? `Task: ${asString(star.task)}` : "",
    star?.action ? `Action: ${asString(star.action)}` : "",
    star?.result ? `Result: ${asString(star.result)}` : ""
  ].filter(Boolean).join(" ")
}

function normalizeQuestion(question = {}, index = 0, label = "Question") {
  const star = question.star && typeof question.star === "object" ? question.star : {}
  const idealAnswer = firstString(question.idealAnswer, question.excellentAnswer)
  const goodAnswer = asString(question.goodAnswer)
  const weakAnswer = asString(question.weakAnswer)
  const answer = firstString(
    question.answer,
    idealAnswer,
    goodAnswer,
    question.expectedAnswer,
    question.sampleAnswer,
    question.modelAnswer,
    joinStar(star),
    question.explanation
  )
  const why = firstString(question.whyInterviewerAsks, question.intention, question.explanation)
  const framework = asString(question.recommendedAnswerFramework || question.answerFramework || question.framework)
  const duration = asString(question.expectedAnswerDuration || question.suggestedDuration || question.duration)
  const keywords = stringArray(question.importantKeywords || question.keywords)
  const explanationParts = [
    asString(question.explanation || question.detailedExplanation),
    framework ? `Framework: ${framework}` : "",
    duration ? `Duration: ${duration}` : "",
    keywords.length ? `Keywords: ${keywords.join(", ")}` : ""
  ].filter(Boolean)
  const explanation = explanationParts.join(" | ") || answer
  const excellentChecklist = stringArray(question.excellentAnswerChecklist || question.checklist)
  const redFlags = stringArray(question.redFlags)
  const skills = stringArray(question.relevantSkills || question.skillsBeingEvaluated || question.evaluatedSkills)

  return {
    question: asString(question.question),
    answer,
    explanation,
    whyInterviewerAsks: why,
    intention: asString(question.intention || why),
    evaluation: [
      ...stringArray(question.evaluation || question.evaluationCriteria),
      ...labeledList("Skills evaluated", skills)
    ],
    difficulty: normalizeDifficulty(question.difficulty),
    bestPractices: [
      ...labeledList("Framework", framework),
      ...stringArray(question.bestPractices || question.answerStructure || question.recommendedAnswerStructure),
      ...labeledList("Excellent checklist", excellentChecklist)
    ],
    commonMistakes: [
      ...stringArray(question.commonMistakes),
      ...labeledList("Red flag", redFlags)
    ],
    recruiterTips: [
      ...labeledList("Ideal answer", idealAnswer),
      ...labeledList("Good answer", goodAnswer),
      ...labeledList("Weak answer", weakAnswer),
      ...labeledList("Tone", question.expectedSpeakingTone || question.speakingTone),
      ...labeledList("Duration", duration),
      ...stringArray(question.recruiterTips || question.coachingTips)
    ],
    followUps: stringArray(question.followUps),
    relevantSkills: skills,
    category: asString(question.category || label),
    star: {
      situation: asString(star.situation),
      task: asString(star.task),
      action: asString(star.action || answer),
      result: asString(star.result)
    },
    _index: index
  }
}

function questionErrors(question, label) {
  const errors = []
  if (question.question.length < 8) errors.push(`${label} question ${question._index + 1} is missing a usable question.`)
  if (question.answer.length < 30) errors.push(`${label} question ${question._index + 1} is missing a usable answer.`)
  return errors
}

function removeInternalFields(question) {
  const { _index, ...clean } = question
  return clean
}

function validateQuestionSection(rawQuestions, key, options = {}) {
  const expectedCount = QUESTION_COUNTS[key]
  const label = options.label || key
  const questions = asArray(rawQuestions).map((question, index) => normalizeQuestion(question, index, label))
  const errors = []

  if (questions.length < expectedCount) {
    errors.push(`${label} requires ${expectedCount} questions; received ${questions.length}.`)
  }

  questions.slice(0, expectedCount).forEach((question) => {
    errors.push(...questionErrors(question, label))
  })

  if (errors.length) {
    throw new GenerationStepError({
      step: `response-validator:${key}`,
      reason: `${label} failed validation.`,
      details: errors,
      payload: { errors, receivedCount: questions.length },
      statusCode: 422,
      retryable: false
    })
  }

  return questions.slice(0, expectedCount).map(removeInternalFields)
}

function normalizeJobAnalysis(value = {}) {
  return {
    jobTitle: asString(value.jobTitle),
    seniority: asString(value.seniority),
    requiredSkills: stringArray(value.requiredSkills),
    preferredSkills: stringArray(value.preferredSkills),
    responsibilities: stringArray(value.responsibilities),
    tools: stringArray(value.tools),
    frameworks: stringArray(value.frameworks),
    technologies: stringArray(value.technologies),
    softSkills: stringArray(value.softSkills),
    experienceLevel: asString(value.experienceLevel),
    industry: asString(value.industry),
    keywords: stringArray(value.keywords)
  }
}

function normalizeSkillGaps(value = []) {
  return asArray(value)
    .map((gap) => ({
      skill: asString(gap?.skill || gap),
      severity: ["low", "medium", "high"].includes(asString(gap?.severity).toLowerCase())
        ? asString(gap.severity).toLowerCase()
        : "medium"
    }))
    .filter((gap) => gap.skill)
}

function normalizeRoadmap(value = []) {
  return asArray(value)
    .map((day, index) => ({
      day: Number.isFinite(Number(day?.day)) ? Number(day.day) : index + 1,
      focus: asString(day?.focus),
      tasks: stringArray(day?.tasks)
    }))
    .filter((day) => day.focus && day.tasks.length)
}

function normalizeStrategy(value = {}) {
  const strategy = { ...(value || {}) }
  for (const key of STRATEGY_KEYS) {
    strategy[key] = stringArray(strategy[key])
  }
  return strategy
}

function validateSection(sectionName, rawValue) {
  switch (sectionName) {
    case "jobAnalysis":
      return normalizeJobAnalysis(rawValue)
    case "technicalQuestions":
      return validateQuestionSection(rawValue, "technicalQuestions", { label: "Technical" })
    case "behavioralQuestions":
      return validateQuestionSection(rawValue, "behavioralQuestions", { label: "Behavioral", requireStar: true })
    case "resumeQuestions":
      return validateQuestionSection(rawValue, "resumeQuestions", { label: "Resume" })
    case "strategy":
      return normalizeStrategy(rawValue)
    case "roadmap":
      return normalizeRoadmap(rawValue)
    case "atsAnalysis":
      return rawValue && typeof rawValue === "object" ? rawValue : {}
    case "resumeBuilder":
      return rawValue && typeof rawValue === "object" ? rawValue : {}
    case "resumeSuggestions":
      return stringArray(rawValue)
    case "skillGaps":
      return normalizeSkillGaps(rawValue)
    default:
      return rawValue
  }
}

function validateReport(rawReport, context = {}) {
  const errors = []
  const jobAnalysis = validateSection("jobAnalysis", rawReport.jobAnalysis || {})
  const roadmap = normalizeRoadmap(rawReport.roadmap || rawReport.preparationPlan)
  const resumeBuilder = validateSection("resumeBuilder", rawReport.resumeBuilder || {})
  const atsAnalysis = validateSection("atsAnalysis", rawReport.atsAnalysis || {})
  const resumeSuggestions = validateSection("resumeSuggestions", rawReport.resumeSuggestions || [])
  const title = compact(rawReport.title || `${jobAnalysis.jobTitle || "Interview"} Strategy`)

  if (title.length < 3) errors.push("Report title is required.")
  if (!roadmap.length) errors.push("Roadmap/preparationPlan is required.")

  let technicalQuestions = []
  let behavioralQuestions = []
  let resumeQuestions = []

  try {
    technicalQuestions = validateSection("technicalQuestions", rawReport.technicalQuestions || [])
  } catch (error) {
    errors.push(error.details || error.reason)
  }

  try {
    behavioralQuestions = validateSection("behavioralQuestions", rawReport.behavioralQuestions || [])
  } catch (error) {
    errors.push(error.details || error.reason)
  }

  try {
    resumeQuestions = validateSection("resumeQuestions", rawReport.resumeQuestions || [])
  } catch (error) {
    errors.push(error.details || error.reason)
  }

  if (errors.length) {
    throw new GenerationStepError({
      step: "response-validator",
      reason: "Gemini report failed critical validation.",
      details: errors.flat().join("\n"),
      payload: { errors },
      statusCode: 422,
      retryable: false
    })
  }

  const report = {
    title,
    jobTitle: compact(rawReport.jobTitle || jobAnalysis.jobTitle),
    company: compact(rawReport.company),
    jobAnalysis,
    matchScore: numberInRange(rawReport.matchScore, 65),
    technicalQuestions,
    behavioralQuestions,
    resumeQuestions,
    skillGaps: normalizeSkillGaps(rawReport.skillGaps),
    strategy: normalizeStrategy(rawReport.strategy),
    roadmap,
    preparationPlan: roadmap,
    atsAnalysis,
    resumeBuilder,
    resumeSuggestions,
    generationWarnings: Array.isArray(rawReport.generationWarnings) ? rawReport.generationWarnings : [],
    atsResumeData: rawReport.atsResumeData || normalizeAtsResumeData({
      resumeBuilder,
      atsAnalysis,
      resumeSuggestions
    })
  }

  logStep("response-validator", "Report validation completed", {
    title: report.title,
    jobTitle: report.jobTitle,
    technicalQuestions: report.technicalQuestions.length,
    behavioralQuestions: report.behavioralQuestions.length,
    resumeQuestions: report.resumeQuestions.length,
    roadmapDays: report.roadmap.length,
    hasResumeBuilder: Boolean(Object.keys(report.resumeBuilder || {}).length),
    contextChars: JSON.stringify(context || {}).length
  })

  return report
}

module.exports = {
  validateReport,
  validateSection,
  QUESTION_COUNTS
}
