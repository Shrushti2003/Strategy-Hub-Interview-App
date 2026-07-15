const { generateJson, streamText } = require("./gemini/gemini-client")
const { GenerationStepError } = require("./gemini/errors")
const { generateInterviewReport, regenerateResumeBuilder } = require("./gemini/report-generator")
const { analyzeResumeStyle, generateResumePdf: renderResumePdf } = require("./gemini/resume-generator")

async function generateCareerChatResponse({ messages = [], user = {} }) {
  const safeMessages = normalizeCareerChatMessages(messages)

  if (!safeMessages.some((message) => message.role === "user")) {
    throw new GenerationStepError({
      step: "career-chat:validation",
      reason: "At least one user message is required.",
      statusCode: 400
    })
  }

  const prompt = buildCareerChatJsonPrompt({ safeMessages, user })

  const parsed = await generateJson({
    prompt,
    step: "career-chat:gemini",
    timeoutMs: 60000
  })

  if (!parsed || typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    throw new GenerationStepError({
      step: "career-chat:validation",
      reason: "Gemini chat response did not contain a reply."
    })
  }

  return parsed.reply
}

async function streamCareerChatResponse({ messages = [], user = {}, onChunk }) {
  const safeMessages = normalizeCareerChatMessages(messages)

  if (!safeMessages.some((message) => message.role === "user")) {
    throw new GenerationStepError({
      step: "career-chat:validation",
      reason: "At least one user message is required.",
      statusCode: 400
    })
  }

  const reply = await streamText({
    prompt: buildCareerChatMarkdownPrompt({ safeMessages, user }),
    step: "career-chat:stream",
    timeoutMs: 60000,
    onChunk
  })

  if (!String(reply || "").trim()) {
    throw new GenerationStepError({
      step: "career-chat:validation",
      reason: "Gemini chat response did not contain a reply."
    })
  }

  return reply
}

function normalizeCareerChatMessages(messages = []) {
  return messages
    .filter((message) => message && ["user", "assistant"].includes(message.role) && String(message.content || "").trim())
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").trim().slice(0, 6000)
    }))
}

function buildCareerChatInstructions() {
  return [
    "You are Strategy Hub AI, a professional career strategist for resumes, interviews, job search, salary, technical learning, system design, coding practice, portfolios, and roadmaps.",
    "Answer from the conversation only. Use clean Markdown.",
    "Be professional, conversational, strategic, educational, and easy to scan.",
    "Use headings, bullets, numbered lists, tables, checklists, or code blocks when useful. Avoid giant paragraphs.",
    "For interview prep, resume review, roadmaps, job analysis, and salary questions, choose the most relevant sections and omit irrelevant ones.",
    "End with a short summary when useful."
  ].join("\n")
}

function buildCareerChatMarkdownPrompt({ safeMessages, user }) {
  const userLabel = user?.username || user?.name || user?.email || ""
  return `${buildCareerChatInstructions()}
${userLabel ? `Signed-in user: ${userLabel}\n` : ""}
Conversation:
${safeMessages.map((message) => `${message.role}: ${message.content}`).join("\n\n")}`
}

function buildCareerChatJsonPrompt({ safeMessages, user }) {
  return `Return exactly one JSON object: { "reply": "" }.

${buildCareerChatInstructions()}
Do not wrap the reply value in markdown fences.

Signed-in user: ${JSON.stringify({ name: user.username || user.name || "", email: user.email || "" })}

Conversation:
${safeMessages.map((message) => `${message.role}: ${message.content}`).join("\n\n")}

JSON only.`
}

async function generateResumePdf({ resume = "", selfDescription = "", jobDescription = "", atsResumeData = {} }) {
  return renderResumePdf({
    atsResumeData,
    plainTextFallback: [resume, selfDescription, jobDescription].filter(Boolean).join("\n\n")
  })
}

module.exports = {
  analyzeResumeStyle,
  generateCareerChatResponse,
  streamCareerChatResponse,
  generateInterviewReport,
  regenerateResumeBuilder,
  generateResumePdf
}
