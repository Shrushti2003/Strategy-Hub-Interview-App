const { logStep } = require("./errors")

function hasObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
}

function payloadSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value || {}), "utf8")
  } catch {
    return 0
  }
}

function summarizeGeneratedPayload(value = {}) {
  const report = value?.toObject ? value.toObject() : value
  const roadmap = Array.isArray(report?.roadmap || report?.preparationPlan)
    ? report.roadmap || report.preparationPlan
    : []
  const atsAnalysis = report?.atsAnalysis && typeof report.atsAnalysis === "object" && !Array.isArray(report.atsAnalysis)
    ? report.atsAnalysis
    : {}
  const skillGaps = Array.isArray(report?.skillGaps) ? report.skillGaps : []
  const technicalQuestions = Array.isArray(report?.technicalQuestions) ? report.technicalQuestions : []
  const behavioralQuestions = Array.isArray(report?.behavioralQuestions) ? report.behavioralQuestions : []
  const resumeQuestions = Array.isArray(report?.resumeQuestions) ? report.resumeQuestions : []

  return {
    payloadBytes: payloadSize(report),
    technicalQuestionsExists: Array.isArray(report?.technicalQuestions),
    technicalCount: technicalQuestions.length,
    technicalQuestionsLength: technicalQuestions.length,
    behavioralQuestionsExists: Array.isArray(report?.behavioralQuestions),
    behavioralCount: behavioralQuestions.length,
    behavioralQuestionsLength: behavioralQuestions.length,
    resumeQuestionsExists: Array.isArray(report?.resumeQuestions),
    resumeCount: resumeQuestions.length,
    resumeQuestionsLength: resumeQuestions.length,
    roadmapExists: roadmap.length > 0,
    roadmapCount: roadmap.length,
    strategyExists: hasObject(report?.strategy),
    resumeBuilderExists: hasObject(report?.resumeBuilder) && report.resumeBuilder?.status !== "unavailable",
    atsResumeExists: hasObject(report?.atsResumeData || report?.atsResume),
    atsAnalysisExists: hasObject(atsAnalysis),
    atsAnalysisKeyCount: Object.keys(atsAnalysis).length,
    atsAnalysisKeys: Object.keys(atsAnalysis),
    matchScore: Number(report?.matchScore || 0),
    skillGapsExists: skillGaps.length > 0,
    skillGapsLength: skillGaps.length,
    skillGapCount: skillGaps.length,
    topLevelKeys: hasObject(report) ? Object.keys(report) : []
  }
}

function logPipelineSnapshot(stage, value = {}, extra = {}) {
  logStep("generation-pipeline", stage, {
    ...extra,
    ...summarizeGeneratedPayload(value)
  })
}

module.exports = {
  logPipelineSnapshot,
  summarizeGeneratedPayload
}
