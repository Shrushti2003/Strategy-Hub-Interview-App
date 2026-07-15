function compact(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function normalizeCandidateText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function inferCandidateName({ resume = "", selfDescription = "", user = {} }) {
  const source = `${resume}\n${selfDescription}`
  const explicit = source.match(/(?:name|candidate|employee)\s*[:\-]\s*([A-Z][A-Za-z .'-]{2,80})/i)

  if (explicit) return compact(explicit[1])
  if (user.username) return compact(user.username)
  if (user.name) return compact(user.name)
  return ""
}

function firstNonEmptyLines(text = "", limit = 8) {
  return normalizeCandidateText(text)
    .split("\n")
    .map(compact)
    .filter((line) => line.length >= 12)
    .slice(0, limit)
}

function extractKeywordMatches(text = "", keywords = []) {
  const source = text.toLowerCase()
  return keywords.filter((keyword) => source.includes(keyword.toLowerCase()))
}

function inferCandidateAnalysis(candidateText = "") {
  const normalized = normalizeCandidateText(candidateText)
  const commonSkills = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express", "MongoDB",
    "SQL", "Python", "Java", "C++", "AWS", "Azure", "Docker", "Kubernetes",
    "REST API", "GraphQL", "Git", "CI/CD", "Data Analysis", "Power BI", "Tableau",
    "Excel", "Machine Learning", "Cybersecurity", "Sales", "CRM", "Leadership",
    "Communication", "Stakeholder Management", "Project Management"
  ]
  const sectionLines = firstNonEmptyLines(normalized, 12)

  return {
    summary: sectionLines.slice(0, 3).join(" ").slice(0, 900),
    skills: extractKeywordMatches(normalized, commonSkills),
    experience: sectionLines.filter((line) => /experience|worked|built|managed|developed|analyst|engineer|executive|intern/i.test(line)).slice(0, 6),
    projects: sectionLines.filter((line) => /project|implemented|created|designed|deployed|dashboard|application|system/i.test(line)).slice(0, 6),
    strengths: sectionLines.filter((line) => /achieved|improved|reduced|increased|led|delivered|optimized|certified/i.test(line)).slice(0, 6),
    weaknesses: []
  }
}

function buildCandidateContext({ resume = "", selfDescription = "", jobDescription = "", user = {} }) {
  const normalizedResume = normalizeCandidateText(resume)
  const normalizedSelfDescription = normalizeCandidateText(selfDescription)
  const candidateText = [normalizedResume, normalizedSelfDescription].filter(Boolean).join("\n\n")
  const sourceType = normalizedResume && normalizedSelfDescription
    ? "resume+self-description"
    : normalizedResume
      ? "resume"
      : "self-description"

  return {
    candidate: {
      name: inferCandidateName({ resume: normalizedResume, selfDescription: normalizedSelfDescription, user }),
      email: user.email || "",
      sourceType,
      candidateText: candidateText.slice(0, 12000),
      selfDescription: normalizedSelfDescription.slice(0, 5000),
      resumeText: candidateText.slice(0, 12000),
      uploadedResumeText: normalizedResume.slice(0, 12000),
      analysis: inferCandidateAnalysis(candidateText)
    },
    jobDescription: normalizeCandidateText(jobDescription).slice(0, 14000),
    generatedAt: new Date().toISOString()
  }
}

module.exports = {
  buildCandidateContext,
  normalizeCandidateText
}
