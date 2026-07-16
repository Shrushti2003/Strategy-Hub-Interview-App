const Module = require("node:module")

let attempts = 0
const originalLoad = Module._load

Module._load = (request, parent, isMain) => {
  if (request !== "@google/genai") {
    return originalLoad(request, parent, isMain)
  }

  return {
    GoogleGenAI: class {
      constructor() {
        this.models = {
          generateContent: async () => {
            attempts += 1
            if (attempts < 3) {
              const error = new Error(JSON.stringify({
                error: {
                  code: 429,
                  status: "RESOURCE_EXHAUSTED",
                  message: "quota"
                }
              }))
              error.status = 429
              throw error
            }

            return {
              text: "{\"ok\":true}",
              usageMetadata: { totalTokenCount: 1 },
              candidates: [{ finishReason: "STOP" }],
              sdkHttpResponse: { status: 200 }
            }
          }
        }
      }
    }
  }
}

process.env.GOOGLE_GENAI_API_KEY = "test"

const { callGeminiWithRetry } = require("../src/services/gemini/gemini-client")

async function main() {
  const retries = []
  const response = await callGeminiWithRetry({
    requestPayload: {
      model: "test",
      contents: "prompt",
      config: {}
    },
    step: "retry-smoke",
    model: "test",
    timeoutMs: 1000,
    maxRetries: 4,
    onRetry: (progress) => {
      retries.push({
        retryAttempt: progress.retryAttempt,
        delayMs: progress.delayMs,
        reason: progress.reason
      })
    }
  })

  console.log(JSON.stringify({
    attempts,
    retries,
    text: response.text
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
