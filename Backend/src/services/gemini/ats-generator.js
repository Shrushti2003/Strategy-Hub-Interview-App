function normalizeAtsResumeData({ resumeBuilder = {}, atsAnalysis = {}, resumeSuggestions = [] }) {
  return {
    ...resumeBuilder,
    atsAnalysis,
    resumeSuggestions
  }
}

module.exports = {
  normalizeAtsResumeData
}
