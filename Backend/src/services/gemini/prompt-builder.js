const { MODEL } = require("./gemini-client")

function compactJson(value) {
  return JSON.stringify(value || {})
}

function compactPromptContext(context = {}) {
  const candidate = context.candidate || {}
  const evidenceText = String(candidate.candidateText || candidate.resumeText || "").slice(0, 7000)

  return {
    candidate: {
      name: candidate.name || "",
      email: candidate.email || "",
      sourceType: candidate.sourceType || "",
      evidenceText,
      analysis: candidate.analysis || {}
    },
    jobDescription: String(context.jobDescription || "").slice(0, 10000),
    jobAnalysis: context.jobAnalysis,
    strategy: context.strategy,
    atsAnalysis: context.atsAnalysis,
    generatedAt: context.generatedAt
  }
}

function baseInstruction(section, context, extra = "") {
  return `Model: ${MODEL}
Generate only the ${section} section for an interview strategy report.
Return exactly one valid JSON object. No markdown, prose, code fences, comments, or trailing text.
Use only the supplied candidate evidence, candidate analysis, user profile, and job description. Do not invent employers, degrees, dates, certifications, contact details, or work history.
If evidence is missing, make the content conditional on the available evidence instead of fabricating facts.
Write like a senior hiring manager and interview coach. Keep every item concise, concrete, role-specific, and grounded in the supplied job description and candidate context.
Preserve depth and coaching quality. Do not replace detailed model answers, STAR coaching, evaluation criteria, recruiter tips, or follow-up coaching with placeholders or generic short notes.
Context:${compactJson(compactPromptContext(context))}
${extra}`.trim()
}

function validationHint(feedback = "") {
  return feedback ? `\nPrevious validation feedback to fix:${feedback}` : ""
}

function buildJobAnalysisPrompt(context, feedback = "") {
  return `${baseInstruction("jobAnalysis", context)}
Return JSON shape:
{"title":"","jobTitle":"","company":"","matchScore":0,"jobAnalysis":{"jobTitle":"","seniority":"","requiredSkills":[],"preferredSkills":[],"responsibilities":[],"tools":[],"frameworks":[],"technologies":[],"softSkills":[],"experienceLevel":"","industry":"","keywords":[]},"skillGaps":[{"skill":"","severity":"low|medium|high"}]}
For skillGaps, choose only gaps supported by the resume/self-description versus the job description. Do not change scoring semantics.
${validationHint(feedback)}`
}

function questionShape(extra = "") {
  return `Each item shape:
{"question":"","answer":"","explanation":"","whyInterviewerAsks":"","evaluation":[],"difficulty":"beginner|intermediate|advanced","bestPractices":[],"commonMistakes":[],"recruiterTips":[],"followUps":[],"relevantSkills":[]${extra}}`
}

function questionCoachingInstruction(type) {
  return `For every ${type} question, use the existing fields as coaching fields:
- whyInterviewerAsks: one short reason interviewers ask it.
- relevantSkills: 3 to 6 evaluated skills or competencies.
- answer: a complete, interview-ready model answer with enough detail to coach the candidate.
- detailedAnswer: preserve a richer version of the model answer when useful.
- explanation: include "Framework: ... | Duration: ... | Keywords: ..." and any role-specific reasoning.
- bestPractices: include answer framework steps and an excellent answer checklist.
- commonMistakes: include common mistakes and red flags.
- recruiterTips: include ideal answer, good answer, weak answer, tone, duration, and coaching tips as labeled bullets.
- evaluation: include how the answer will be scored.
- followUps: 2 to 5 realistic follow-up questions that stay on-topic and deepen naturally.
Do not shorten coaching by omitting fields. Prefer complete, useful interview coaching over terse answers.`
}

function buildTechnicalQuestionsPrompt(context, jobAnalysis, feedback = "") {
  return `${baseInstruction("technicalQuestions", { ...context, jobAnalysis })}
Generate exactly 20 technical interview questions specific to the role, skills, tools, and responsibilities.
Return: {"technicalQuestions":[]}
${questionShape()}
Answers must be unique, concrete, and job-specific.
Create intelligent follow-up chains: each follow-up should move from basics to implementation, metrics, debugging, scale, security, or tradeoffs when relevant.
${questionCoachingInstruction("technical")}
${validationHint(feedback)}`
}

function buildBehavioralQuestionsPrompt(context, jobAnalysis, feedback = "") {
  return `${baseInstruction("behavioralQuestions", { ...context, jobAnalysis })}
Generate exactly 10 behavioral interview questions specific to the role and seniority.
Return: {"behavioralQuestions":[]}
${questionShape(',"star":{"situation":"","task":"","action":"","result":""}')}
Every item must include a complete STAR answer. Answers must be unique.
Include best answering framework, expected speaking tone, recommended answer structure, and suggested duration using existing fields.
${questionCoachingInstruction("behavioral")}
${validationHint(feedback)}`
}

function buildResumeQuestionsPrompt(context, jobAnalysis, feedback = "") {
  return `${baseInstruction("resumeQuestions", { ...context, jobAnalysis })}
Generate exactly 10 questions grounded in the supplied resume, self-description, or job description.
Return: {"resumeQuestions":[]}
${questionShape()}
Every question must reference visible candidate/job evidence from resume, self-description, work history, projects, achievements, or job requirements. Avoid generic questions whenever personalized context exists. Do not invent missing resume facts.
${questionCoachingInstruction("resume")}
${validationHint(feedback)}`
}

function buildStrategyPrompt(context, jobAnalysis, feedback = "") {
  return `${baseInstruction("strategy", { ...context, jobAnalysis })}
Return: {"strategy":{}}
strategy must contain arrays for: importantTopics, frequentlyAskedAreas, skillsToStrengthen, commonMistakes, salaryNegotiationTips, interviewTips, finalChecklist, topicsToPrioritize, topicsSafeToSkip, likelyInterviewRounds, preparationOrder, timeAllocation, companyExpectations, highImpactConcepts, mostProbableQuestions, commonRejectionReasons, finalInterviewTips, roadmapImmediate, roadmapOneWeek, roadmapTwoWeeks, roadmapOneMonth, roadmapAdvanced, interviewReadyChecklist, freeLearningResources.
Also include priorityCritical, priorityHigh, priorityMedium, and priorityLow arrays. Each item should be "Topic - short explanation". Keep all items concise.${validationHint(feedback)}`
}

function buildRoadmapPrompt(context, jobAnalysis, strategy, feedback = "") {
  return `${baseInstruction("roadmap", { ...context, jobAnalysis, strategy })}
Create a practical preparation roadmap.
Return: {"roadmap":[{"day":1,"focus":"","tasks":[]}]}
Use 7 to 14 days unless the job context clearly requires longer.
For each day, keep focus concise and put structured coaching into tasks using labels: Goal, Estimated study time, Topics, Practice questions, Checkpoint, Expected confidence.${validationHint(feedback)}`
}

function buildAtsAnalysisPrompt(context, jobAnalysis, feedback = "") {
  return `${baseInstruction("atsAnalysis", { ...context, jobAnalysis })}
Return: {"atsAnalysis":{"atsScore":0,"missingKeywords":[],"matchedKeywords":[],"weakBullets":[],"missingSkills":[],"suggestedProjects":[],"grammarIssues":[],"formattingIssues":[],"suggestedImprovements":[],"summarySuggestions":[],"projectImprovements":[],"skillsImprovements":[],"finalOptimizedSuggestions":[]},"resumeSuggestions":[]}
Ground keyword findings in the job description and supplied candidate evidence only.${validationHint(feedback)}`
}

function buildResumeBuilderPrompt(context, jobAnalysis, atsAnalysis, feedback = "") {
  return `${baseInstruction("resumeBuilder", { ...context, jobAnalysis, atsAnalysis })}
Return: {"resumeBuilder":{"personalInfo":{},"summary":"","technicalSkills":[],"softSkills":[],"keywords":[],"workExperience":[],"projects":[],"education":[],"certifications":[],"achievements":[]}}
Only use facts present in the resume/self-description/user profile. Leave unknown fields empty.${validationHint(feedback)}`
}

function buildCoreReportPrompt(context, feedback = "") {
  return `${baseInstruction("core report", context)}
Return exactly this JSON shape:
{"title":"","jobTitle":"","company":"","matchScore":0,"jobAnalysis":{"jobTitle":"","seniority":"","requiredSkills":[],"preferredSkills":[],"responsibilities":[],"tools":[],"frameworks":[],"technologies":[],"softSkills":[],"experienceLevel":"","industry":"","keywords":[]},"skillGaps":[{"skill":"","severity":"low|medium|high"}],"atsAnalysis":{"atsScore":0,"missingKeywords":[],"matchedKeywords":[],"weakBullets":[],"missingSkills":[],"suggestedProjects":[],"grammarIssues":[],"formattingIssues":[],"suggestedImprovements":[],"summarySuggestions":[],"projectImprovements":[],"skillsImprovements":[],"finalOptimizedSuggestions":[]},"resumeSuggestions":[],"strategy":{}}
strategy must contain arrays for: importantTopics, frequentlyAskedAreas, skillsToStrengthen, commonMistakes, salaryNegotiationTips, interviewTips, finalChecklist, topicsToPrioritize, topicsSafeToSkip, likelyInterviewRounds, preparationOrder, timeAllocation, companyExpectations, highImpactConcepts, mostProbableQuestions, commonRejectionReasons, finalInterviewTips, roadmapImmediate, roadmapOneWeek, roadmapTwoWeeks, roadmapOneMonth, roadmapAdvanced, interviewReadyChecklist, freeLearningResources, priorityCritical, priorityHigh, priorityMedium, priorityLow.
Each priority item should be "Topic - short explanation". Keep all items concise.
Ground ATS findings in the job description and supplied candidate evidence only.
atsAnalysis is required and must include non-empty ATS keyword findings keyed to this candidate and job.
skillGaps is required and must contain at least one supported gap. If the candidate is strong, include the smallest real gap or growth area supported by the evidence; do not invent unrelated gaps.
For skillGaps, choose only gaps supported by the resume/self-description versus the job description. Do not change scoring semantics.${validationHint(feedback)}`
}

function buildQuestionSetPrompt(context, jobAnalysis, feedback = "") {
  return `${baseInstruction("question set", { ...context, jobAnalysis })}
Generate exactly 20 technicalQuestions, exactly 10 behavioralQuestions, and exactly 10 resumeQuestions.
Return exactly: {"technicalQuestions":[],"behavioralQuestions":[],"resumeQuestions":[]}
Technical questions must be specific to the role, skills, tools, and responsibilities.
Technical follow-ups should deepen naturally from basics to implementation, metrics, debugging, scale, security, or tradeoffs.
Behavioral questions must be specific to the role and seniority and include complete STAR answers.
Resume questions must reference visible candidate/job evidence from resume, self-description, work history, projects, achievements, or job requirements. Avoid generic resume questions when personalized context exists.
${questionShape()}
Behavioral items additionally need "star":{"situation":"","task":"","action":"","result":""}.
For STAR fields, use one sentence per field.
${questionCoachingInstruction("technical, behavioral, and resume")}
${validationHint(feedback)}`
}

function buildRoadmapAndResumePrompt(context, jobAnalysis, strategy, atsAnalysis, includeResumeBuilder = true, feedback = "") {
  return `${baseInstruction(includeResumeBuilder ? "roadmap and resumeBuilder" : "roadmap", { ...context, jobAnalysis, strategy, atsAnalysis })}
Return exactly: ${includeResumeBuilder
    ? '{"roadmap":[{"day":1,"focus":"","tasks":[]}],"resumeBuilder":{"personalInfo":{},"summary":"","technicalSkills":[],"softSkills":[],"keywords":[],"workExperience":[],"projects":[],"education":[],"certifications":[],"achievements":[]}}'
    : '{"roadmap":[{"day":1,"focus":"","tasks":[]}]}'}
Create a practical 7 to 14 day preparation roadmap unless the job context clearly requires longer.
For each roadmap day, keep focus concise and put structured coaching into tasks using labels: Goal, Estimated study time, Topics, Practice questions, Checkpoint, Expected confidence.
${includeResumeBuilder ? "For resumeBuilder, only use facts present in the resume/self-description/user profile. Leave unknown fields empty." : ""}
${validationHint(feedback)}`
}

module.exports = {
  buildJobAnalysisPrompt,
  buildTechnicalQuestionsPrompt,
  buildBehavioralQuestionsPrompt,
  buildResumeQuestionsPrompt,
  buildStrategyPrompt,
  buildRoadmapPrompt,
  buildAtsAnalysisPrompt,
  buildResumeBuilderPrompt,
  buildCoreReportPrompt,
  buildQuestionSetPrompt,
  buildRoadmapAndResumePrompt
}
