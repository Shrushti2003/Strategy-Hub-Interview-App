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

  return {
    payloadBytes: payloadSize(report),
    technicalCount: Array.isArray(report?.technicalQuestions) ? report.technicalQuestions.length : 0,
    behavioralCount: Array.isArray(report?.behavioralQuestions) ? report.behavioralQuestions.length : 0,
    resumeCount: Array.isArray(report?.resumeQuestions) ? report.resumeQuestions.length : 0,
    technicalQuestionsLength: Array.isArray(report?.technicalQuestions) ? report.technicalQuestions.length : 0,
    behavioralQuestionsLength: Array.isArray(report?.behavioralQuestions) ? report.behavioralQuestions.length : 0,
    resumeQuestionsLength: Array.isArray(report?.resumeQuestions) ? report.resumeQuestions.length : 0,
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
