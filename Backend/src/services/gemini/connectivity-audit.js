const { env, maskSecret } = require("../../config/env")
const { generateJson, MODEL, MODEL_CHAIN, ENDPOINT, classifyGoogleError, resolveModelConfig } = require("./gemini-client")
const { GenerationStepError, logStep } = require("./errors")
const backendPackage = require("../../../package.json")
const backendPackageLock = require("../../../package-lock.json")

const healthSamples = []
let lastGoogleError = null

function sdkVersion() {
  return backendPackageLock.packages?.["node_modules/@google/genai"]?.version ||
    backendPackage.dependencies?.["@google/genai"] ||
    "installed"
}

function classifyGeminiFailure(error) {
  const googleError = error?.payload?.googleError || {}
  const normalized = {
    ...googleError,
    httpStatus: error?.statusCode || error?.status || googleError.httpStatus
  }
  const classification = classifyGoogleError(normalized)

  if (!env.GOOGLE_GENAI_API_KEY) return "Missing key"
  if (classification.reason !== "Gemini request failed.") return classification.reason

  const message = String(error?.details || error?.reason || error?.message || "")
  if (/fetch failed|ENOTFOUND|ECONN|network/i.test(message)) return "Network or endpoint connectivity issue"
  if (/disabled|SERVICE_DISABLED|API has not been used/i.test(message)) return "Gemini API disabled for this Google project"
  return "Unknown Gemini connectivity issue"
}

async function auditGeminiConnectivity({ requestId = "" } = {}) {
  const modelConfig = await resolveModelConfig({ requestId })
  const audit = {
    requestId,
    dotenvLoaded: Boolean(env.JWT_SECRET || env.MONGO_URI || env.GOOGLE_GENAI_API_KEY),
    envVar: "GOOGLE_GENAI_API_KEY",
    keyExists: Boolean(env.GOOGLE_GENAI_API_KEY),
    keyPreview: maskSecret(env.GOOGLE_GENAI_API_KEY),
    sdkPackage: "@google/genai",
    sdkVersion: sdkVersion(),
    model: MODEL,
    requestedModelChain: MODEL_CHAIN,
    modelChain: modelConfig.modelChain,
    endpoint: ENDPOINT,
    authMode: "apiKey"
  }

  logStep("gemini-connectivity", "Connectivity audit started", audit)

  if (!audit.keyExists) {
    throw new GenerationStepError({
      step: "gemini-connectivity",
      reason: "GOOGLE_GENAI_API_KEY is missing.",
      details: JSON.stringify(audit),
      statusCode: 500,
      payload: audit
    })
  }

  try {
    const startedAt = Date.now()
    const response = await generateJson({
      step: "gemini-connectivity",
      timeoutMs: 20000,
      maxRetries: 0,
      requestId,
      prompt: 'Return exactly this JSON object and nothing else: { "status": "ok" }'
    })
    const responseTimeMs = Date.now() - startedAt

    if (response?.status !== "ok") {
      throw new GenerationStepError({
        step: "gemini-connectivity",
        reason: "Gemini connectivity probe returned unexpected JSON.",
        details: JSON.stringify(response),
        payload: { audit, response }
      })
    }

    logStep("gemini-connectivity", "Connectivity audit completed", {
      ...audit,
      status: response.status,
      responseTimeMs
    })

    healthSamples.push(responseTimeMs)
    if (healthSamples.length > 5) healthSamples.shift()
    lastGoogleError = null

    return {
      ...audit,
      status: "ok",
      responseTimeMs
    }
  } catch (error) {
    const originalGoogleError = error?.payload?.googleError || {
      message: error?.message,
      details: error?.details,
      statusCode: error?.statusCode || error?.status
    }
    lastGoogleError = originalGoogleError
    const exactFailure = classifyGeminiFailure(error)

    throw new GenerationStepError({
      step: "gemini-connectivity",
      reason: exactFailure,
      details: originalGoogleError,
      payload: {
        ...audit,
        googleError: originalGoogleError
      },
      statusCode: error?.statusCode || error?.status || 502,
      retryable: error?.retryable,
      cause: error
    })
  }
}

async function geminiHealth() {
  const startedAt = Date.now()

  try {
    const audit = await auditGeminiConnectivity({ requestId: "health" })
    const averageResponseTimeMs = healthSamples.length
      ? Math.round(healthSamples.reduce((total, sample) => total + sample, 0) / healthSamples.length)
      : audit.responseTimeMs

    return {
      sdkVersion: audit.sdkVersion,
      configuredModel: MODEL,
      modelChain: MODEL_CHAIN,
      verifiedModelChain: audit.modelChain,
      apiKeyPresent: Boolean(env.GOOGLE_GENAI_API_KEY),
      connectivity: true,
      responseTimeMs: Date.now() - startedAt,
      averageResponseTimeMs,
      lastGoogleError
    }
  } catch (error) {
    return {
      sdkVersion: sdkVersion(),
      configuredModel: MODEL,
      modelChain: MODEL_CHAIN,
      verifiedModelChain: lastGoogleError?.modelChain || [],
      apiKeyPresent: Boolean(env.GOOGLE_GENAI_API_KEY),
      connectivity: false,
      responseTimeMs: Date.now() - startedAt,
      averageResponseTimeMs: healthSamples.length
        ? Math.round(healthSamples.reduce((total, sample) => total + sample, 0) / healthSamples.length)
        : null,
      lastGoogleError,
      reason: error.reason || error.message
    }
  }
}

module.exports = {
  auditGeminiConnectivity,
  classifyGeminiFailure,
  geminiHealth
}
