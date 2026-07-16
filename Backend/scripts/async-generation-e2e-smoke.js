const Module = require("node:module")
const assert = require("node:assert/strict")
const path = require("node:path")
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true })

const printResult = console.log.bind(console)
if (process.env.SMOKE_VERBOSE !== "true") {
  console.log = () => {}
}

function makeQuestion(index, section) {
  return {
    question: `${section} question ${index + 1}: Explain the production decision and tradeoffs.`,
    answer: "A strong answer explains the context, constraints, implementation, tradeoffs, monitoring, security considerations, and measurable production outcome.",
    explanation: "Framework: Context, tradeoff, outcome | Duration: 2 minutes | Keywords: reliability, ownership",
    whyInterviewerAsks: "To verify practical depth and ownership.",
    evaluation: ["Clarity", "Tradeoff quality", "Production impact"],
    difficulty: index % 3 === 0 ? "advanced" : "intermediate",
    bestPractices: ["Use concrete metrics", "Explain tradeoffs", "Tie back to job requirements"],
    commonMistakes: ["Speaking generically", "Skipping failure modes"],
    recruiterTips: ["Ideal answer: specific and measured", "Good answer: clear tradeoffs"],
    followUps: ["How did you monitor success?", "What would you change now?"],
    relevantSkills: ["System design", "Debugging", "Communication"],
    star: {
      situation: "A production system needed a reliability improvement.",
      task: "Own the fix without breaking user workflows.",
      action: "Designed, shipped, monitored, and iterated on the solution.",
      result: "Reduced incidents and improved confidence."
    }
  }
}

function responseForPrompt(prompt) {
  if (prompt.includes("core report")) {
    return {
      title: "Senior Backend Engineer Interview Strategy",
      jobTitle: "Senior Backend Engineer",
      company: "Strategy Hub Test",
      matchScore: 84,
      jobAnalysis: {
        jobTitle: "Senior Backend Engineer",
        seniority: "Senior",
        requiredSkills: ["Node.js", "MongoDB", "API design"],
        preferredSkills: ["AI systems"],
        responsibilities: ["Build resilient services"],
        tools: ["Express", "MongoDB"],
        frameworks: ["Express"],
        technologies: ["Node.js"],
        softSkills: ["Ownership"],
        experienceLevel: "5+ years",
        industry: "SaaS",
        keywords: ["backend", "production"]
      },
      skillGaps: [{ skill: "Distributed tracing", severity: "medium" }],
      atsAnalysis: {
        atsScore: 82,
        missingKeywords: ["observability"],
        matchedKeywords: ["Node.js", "MongoDB"],
        weakBullets: ["Add measurable impact"],
        missingSkills: ["Tracing"],
        suggestedProjects: ["API resilience project"],
        grammarIssues: [],
        formattingIssues: [],
        suggestedImprovements: ["Quantify production impact"],
        summarySuggestions: ["Mention backend scale"],
        projectImprovements: ["Add latency metrics"],
        skillsImprovements: ["Add observability"],
        finalOptimizedSuggestions: ["Tailor bullets to API reliability"]
      },
      resumeSuggestions: ["Add metrics to backend projects"],
      strategy: {
        importantTopics: ["API design - explain production tradeoffs"],
        frequentlyAskedAreas: ["Node.js internals"],
        skillsToStrengthen: ["Observability"],
        commonMistakes: ["Ignoring failure modes"],
        salaryNegotiationTips: ["Anchor on impact"],
        interviewTips: ["Use specific incidents"],
        finalChecklist: ["Prepare metrics"],
        topicsToPrioritize: ["Authentication"],
        topicsSafeToSkip: ["Unrelated UI trivia"],
        likelyInterviewRounds: ["System design"],
        preparationOrder: ["Resume story", "System design"],
        timeAllocation: ["60% system design"],
        companyExpectations: ["Ownership"],
        highImpactConcepts: ["Reliability"],
        mostProbableQuestions: ["Design a scalable API"],
        commonRejectionReasons: ["Vague answers"],
        finalInterviewTips: ["Close with questions"],
        roadmapImmediate: ["Review APIs"],
        roadmapOneWeek: ["Practice designs"],
        roadmapTwoWeeks: ["Mock interviews"],
        roadmapOneMonth: ["Build project"],
        roadmapAdvanced: ["Deep observability"],
        interviewReadyChecklist: ["Stories ready"],
        freeLearningResources: ["Official Node docs"],
        priorityCritical: ["API design - core"],
        priorityHigh: ["MongoDB - important"],
        priorityMedium: ["AI integrations - useful"],
        priorityLow: ["CSS - low relevance"]
      }
    }
  }

  if (prompt.includes("question set")) {
    return {
      technicalQuestions: Array.from({ length: 20 }, (_, index) => makeQuestion(index, "Technical")),
      behavioralQuestions: Array.from({ length: 10 }, (_, index) => makeQuestion(index, "Behavioral")),
      resumeQuestions: Array.from({ length: 10 }, (_, index) => makeQuestion(index, "Resume"))
    }
  }

  if (prompt.includes("roadmap and resumeBuilder")) {
    return {
      roadmap: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        focus: `Preparation focus ${index + 1}`,
        tasks: [
          "Goal: strengthen role-specific interview readiness",
          "Estimated study time: 2 hours",
          "Topics: APIs, MongoDB, reliability",
          "Practice questions: explain one production tradeoff",
          "Checkpoint: answer with metrics",
          "Expected confidence: high"
        ]
      })),
      resumeBuilder: {
        personalInfo: { fullName: "Test Candidate" },
        summary: "Backend engineer with production API experience.",
        technicalSkills: ["Node.js", "MongoDB", "Express"],
        softSkills: ["Ownership"],
        keywords: ["API", "reliability"],
        workExperience: [{ role: "Backend Engineer", company: "Example", description: "Built resilient APIs." }],
        projects: [{ name: "Strategy Hub", description: "AI interview generation platform." }],
        education: [],
        certifications: [],
        achievements: ["Improved API reliability"]
      }
    }
  }

  if (prompt.includes("\"roadmap\"")) {
    return {
      roadmap: [{
        day: 1,
        focus: "Fallback roadmap",
        tasks: ["Goal: continue preparation"]
      }]
    }
  }

  return { reply: "ok" }
}

if (process.env.SMOKE_USE_REAL_GEMINI !== "true") {
  const originalLoad = Module._load
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "@google/genai") {
      return {
        GoogleGenAI: class {
          constructor() {
            this.models = {
              generateContent: async ({ contents }) => ({
                text: JSON.stringify(responseForPrompt(String(contents || ""))),
                sdkHttpResponse: { status: 200 },
                usageMetadata: { totalTokenCount: 1000 }
              })
            }
          }
        }
      }
    }

    return originalLoad.call(this, request, parent, isMain)
  }
}

process.env.NODE_ENV = "development"
process.env.JWT_SECRET = process.env.JWT_SECRET || "strategy-hub-smoke-test-secret-32-chars"
if (process.env.SMOKE_USE_REAL_GEMINI !== "true") {
  process.env.GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || "smoke-test-key"
}
process.env.MONGO_URI = ""

const app = require("../src/app")

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] || ""
}

async function postJson(baseUrl, path, payload, cookie = "") {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(payload)
  })
}

async function main() {
  const server = app.listen(0)
  await new Promise((resolve) => server.once("listening", resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  try {
    const unique = Date.now()
    const registerResponse = await postJson(baseUrl, "/api/auth/register", {
      username: `Smoke ${unique}`,
      email: `smoke-${unique}@example.com`,
      password: "Password123"
    })
    assert.equal(registerResponse.status, 201)
    const cookie = cookieFrom(registerResponse)
    assert.ok(cookie.includes("token="))

    const formData = new FormData()
    formData.append("jobDescription", "Senior Backend Engineer role requiring Node.js, Express, MongoDB, APIs, observability, and production ownership.")
    formData.append("selfDescription", "Senior backend engineer with Node.js, MongoDB, API design, authentication, production debugging, and AI product experience.")

    const generationResponse = await fetch(`${baseUrl}/api/interview`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: formData
    })
    assert.equal(generationResponse.status, 201)
    const generation = await generationResponse.json()
    assert.equal(generation.status, "processing")
    assert.ok(generation.reportId)

    const isLiveGemini = process.env.SMOKE_USE_REAL_GEMINI === "true"
    const maxAttempts = isLiveGemini ? 120 : 30
    const pollDelayMs = isLiveGemini ? 2000 : 100
    let status = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, pollDelayMs))
      const statusResponse = await fetch(`${baseUrl}/api/interview/${generation.reportId}/status`, {
        headers: { Cookie: cookie }
      })
      assert.equal(statusResponse.status, 200)
      status = await statusResponse.json()
      if (status.status !== "processing") break
    }

    assert.equal(status.status, "completed", JSON.stringify(status))

    const reportResponse = await fetch(`${baseUrl}/api/interview/report/${generation.reportId}`, {
      headers: { Cookie: cookie }
    })
    assert.equal(reportResponse.status, 200)
    const { interviewReport } = await reportResponse.json()

    assert.equal(interviewReport.technicalQuestions.length, 20)
    assert.equal(interviewReport.behavioralQuestions.length, 10)
    assert.equal(interviewReport.resumeQuestions.length, 10)
    assert.ok(Object.keys(interviewReport.strategy || {}).length > 0)
    assert.ok((interviewReport.roadmap || []).length > 0)
    assert.ok(Object.keys(interviewReport.resumeBuilder || {}).length > 0)
    assert.ok(Object.keys(interviewReport.atsAnalysis || {}).length > 0)
    assert.ok((interviewReport.skillGaps || []).length > 0)
    assert.ok(Number(interviewReport.matchScore) > 0)

    printResult(JSON.stringify({
      status: status.status,
      technicalQuestions: interviewReport.technicalQuestions.length,
      behavioralQuestions: interviewReport.behavioralQuestions.length,
      resumeQuestions: interviewReport.resumeQuestions.length,
      strategyKeys: Object.keys(interviewReport.strategy || {}).length,
      roadmapDays: interviewReport.roadmap.length,
      hasAtsResume: Object.keys(interviewReport.resumeBuilder || {}).length > 0,
      skillGaps: interviewReport.skillGaps.length,
      matchScore: interviewReport.matchScore
    }, null, 2))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
