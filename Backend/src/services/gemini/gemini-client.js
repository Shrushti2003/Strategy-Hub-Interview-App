const { GoogleGenAI } = require("@google/genai")
const { env } = require("../../config/env")
const { GenerationStepError, logFailure, logStep } = require("./errors")
const { parseJsonOnly, findBalancedJson } = require("./json-parser")
const { summarizeGeneratedPayload } = require("./pipeline-snapshot")

const DEFAULT_MODEL = "gemini-3.5-flash"
const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro"
]
const MODEL = env.GEMINI_MODEL || DEFAULT_MODEL
const REQUESTED_MODEL_CHAIN = [
  MODEL,
  ...CANDIDATE_MODELS.filter((model) => model !== MODEL)
]
const ENDPOINT = "Google GenAI SDK models.generateContent"
const DEFAULT_TIMEOUT_MS = 180000
const DEFAULT_MAX_RETRIES = 4
const RETRY_BACKOFF_MS = [2000, 5000, 10000, 20000]
const RETRYABLE_HTTP_STATUSES = new Set([429, 503, 504])
const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT"])
const RETRYABLE_GOOGLE_STATUSES = new Set([
  "RESOURCE_EXHAUSTED",
  "DEADLINE_EXCEEDED",
  "UNAVAILABLE"
])
const FALLBACK_GOOGLE_STATUSES = new Set([
  "NOT_FOUND",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED"
])
const hasApiKey = Boolean(env.GOOGLE_GENAI_API_KEY)
const client = hasApiKey ? new GoogleGenAI({ apiKey: env.GOOGLE_GENAI_API_KEY }) : null
let resolvedModelConfig = null
const requestModelState = new Map()

function modelStateKey(requestId = "") {
  return requestId || "global"
}

function getRequestModelState(requestId = "") {
  const key = modelStateKey(requestId)
  let state = requestModelState.get(key)

  if (!state) {
    state = {
      unavailableModels: new Set(),
      preferredModel: "",
      quotaErrors: []
    }
    requestModelState.set(key, state)

    if (requestModelState.size > 100) {
      const [oldestKey] = requestModelState.keys()
      requestModelState.delete(oldestKey)
    }
  }

  return state
}

function isQuotaGoogleError(googleError = {}) {
  return String(googleError?.code || "").toUpperCase() === "RESOURCE_EXHAUSTED" ||
    Number(googleError?.httpStatus || 0) === 429 ||
    /quota|RESOURCE_EXHAUSTED/i.test(String(googleError?.message || ""))
}

function markModelUnavailableForRequest({ requestId = "", model, googleError = {}, step = "" }) {
  if (!model || !isQuotaGoogleError(googleError)) {
    return
  }

  const state = getRequestModelState(requestId)
  state.unavailableModels.add(model)
  state.quotaErrors.push({
    step,
    model,
    httpStatus: googleError.httpStatus,
    googleStatus: googleError.code,
    message: googleError.message
  })

  if (state.preferredModel === model) {
    state.preferredModel = ""
  }

  logStep(step || "gemini-model-selection", "Marked Gemini model unavailable for request after quota exhaustion", {
    requestId,
    model,
    unavailableModels: Array.from(state.unavailableModels),
    httpStatus: googleError.httpStatus,
    googleStatus: googleError.code
  })
}

function markModelSuccessfulForRequest({ requestId = "", model, step = "" }) {
  if (!model) {
    return
  }

  const state = getRequestModelState(requestId)
  if (state.unavailableModels.has(model)) {
    return
  }

  state.preferredModel = model

  logStep(step || "gemini-model-selection", "Remembered successful Gemini model for remaining request stages", {
    requestId,
    model,
    unavailableModels: Array.from(state.unavailableModels)
  })
}

function requestScopedModelChain(modelChain = [], requestId = "") {
  const state = getRequestModelState(requestId)
  const available = modelChain.filter((model) => !state.unavailableModels.has(model))

  if (state.preferredModel && available.includes(state.preferredModel)) {
    return [
      state.preferredModel,
      ...available.filter((model) => model !== state.preferredModel)
    ]
  }

  return available
}

function quotaExhaustedError({ step, requestId, modelChain = [] }) {
  const state = getRequestModelState(requestId)

  return new GenerationStepError({
    step,
    reason: "AI generation is temporarily unavailable because the configured Gemini API quota has been exhausted. Please retry later.",
    details: state.quotaErrors,
    payload: {
      endpoint: ENDPOINT,
      requestId,
      modelChain,
      unavailableModels: Array.from(state.unavailableModels),
      quotaErrors: state.quotaErrors
    },
    statusCode: 429,
    retryable: true
  })
}

function parseJsonMessage(message = "") {
  try {
    return JSON.parse(message)
  } catch {
    return null
  }
}

function summarizeRawJsonResponse(text = "") {
  const raw = String(text || "")
  try {
    return summarizeGeneratedPayload(JSON.parse(raw))
  } catch {
    const extracted = findBalancedJson(raw)
    if (!extracted) return {}

    try {
      return summarizeGeneratedPayload(JSON.parse(extracted))
    } catch {
      return {}
    }
  }
}

function extractGoogleError(error) {
  const parsedMessage = parseJsonMessage(error?.message)
  const apiResponseBody = error?.error || parsedMessage || null
  const googleError = apiResponseBody?.error || apiResponseBody || {}

  return {
    name: error?.name,
    httpStatus: error?.status || googleError?.code || null,
    code: googleError?.status || googleError?.code || null,
    networkCode: error?.code || error?.cause?.code || "",
    message: googleError?.message || error?.message || "Gemini request failed.",
    details: googleError?.details || [],
    apiResponseBody,
    stack: error?.stack || ""
  }
}

function isRetryableGoogleError(googleError) {
  return RETRYABLE_HTTP_STATUSES.has(Number(googleError?.httpStatus)) ||
    RETRYABLE_GOOGLE_STATUSES.has(String(googleError?.code || "")) ||
    RETRYABLE_NETWORK_CODES.has(String(googleError?.networkCode || ""))
}

function shouldFallbackModel(googleError) {
  const status = String(googleError?.code || "")
  const message = String(googleError?.message || "")

  return status === "NOT_FOUND" ||
    status === "RESOURCE_EXHAUSTED" ||
    FALLBACK_GOOGLE_STATUSES.has(status) ||
    /overload|overloaded|temporarily busy|try again later|quota exceeded/i.test(message)
}

function classifyGoogleError(googleError) {
  const code = String(googleError?.code || "")
  const status = Number(googleError?.httpStatus || 0)
  const message = String(googleError?.message || "")

  if (/API_KEY_INVALID|API key not valid/i.test(message) || code === "API_KEY_INVALID") {
    return {
      reason: "Gemini API key is invalid.",
      statusCode: 401,
      retryable: false
    }
  }

  if (code === "INVALID_ARGUMENT" || status === 400) {
    return {
      reason: "Invalid request",
      statusCode: 400,
      retryable: false
    }
  }

  if (code === "PERMISSION_DENIED" || status === 403) {
    return {
      reason: "Permission denied",
      statusCode: 403,
      retryable: false
    }
  }

  if (code === "RESOURCE_EXHAUSTED" || status === 429) {
    return {
      reason: "Gemini quota exceeded. Please try again later.",
      statusCode: 429,
      retryable: true
    }
  }

  if (code === "DEADLINE_EXCEEDED" || status === 504) {
    return {
      reason: "Gemini request timed out. Please try again.",
      statusCode: 504,
      retryable: true
    }
  }

  if (code === "UNAVAILABLE" || status === 503) {
    return {
      reason: "Gemini is temporarily busy. Please try again shortly.",
      statusCode: 503,
      retryable: true
    }
  }

  if (code === "NOT_FOUND" || status === 404) {
    return {
      reason: "Model unavailable",
      statusCode: 502,
      retryable: false
    }
  }

  if (RETRYABLE_HTTP_STATUSES.has(status)) {
    return {
      reason: "Gemini is temporarily busy. Please try again shortly.",
      statusCode: status,
      retryable: true
    }
  }

  if (RETRYABLE_NETWORK_CODES.has(String(googleError?.networkCode || ""))) {
    return {
      reason: "Gemini network request failed. Please try again shortly.",
      statusCode: 503,
      retryable: true
    }
  }

  return {
    reason: googleError?.message || "Gemini request failed.",
    statusCode: status >= 400 ? 502 : 500,
    retryable: false
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(retryIndex) {
  return RETRY_BACKOFF_MS[Math.min(retryIndex, RETRY_BACKOFF_MS.length - 1)]
}

async function verifyModel(model, timeoutMs = 12000) {
  const startedAt = Date.now()

  try {
    const response = await callGeminiWithRetry({
      step: "gemini-model-verification",
      model,
      timeoutMs,
      maxRetries: 1,
      requestId: `verify_${model}`,
      requestPayload: {
        model,
        contents: "Return JSON: {\"ok\":true}",
        config: {
          responseMimeType: "application/json",
          httpOptions: {
            timeout: timeoutMs
          }
        }
      }
    })

    return {
      model,
      available: true,
      elapsedMs: Date.now() - startedAt,
      modelVersion: response.modelVersion || model
    }
  } catch (error) {
    const googleError = extractGoogleError(error)
    return {
      model,
      available: false,
      elapsedMs: Date.now() - startedAt,
      googleError
    }
  }
}

async function resolveModelConfig({ requestId = "", force = false } = {}) {
  if (resolvedModelConfig && !force) {
    return resolvedModelConfig
  }

  if (!client || env.GEMINI_VERIFY_MODELS !== "true") {
    resolvedModelConfig = {
      configuredModel: MODEL,
      requestedModelChain: REQUESTED_MODEL_CHAIN,
      modelChain: client ? REQUESTED_MODEL_CHAIN : [],
      verifiedAt: new Date().toISOString(),
      verification: [],
      verificationSkipped: Boolean(client)
    }
    return resolvedModelConfig
  }

  const verification = []
  for (const model of REQUESTED_MODEL_CHAIN) {
    const result = await verifyModel(model)
    verification.push(result)
    logStep("gemini-model-resolution", "Gemini model verification completed", {
      requestId,
      model,
      available: result.available,
      elapsedMs: result.elapsedMs,
      httpStatus: result.googleError?.httpStatus,
      googleStatus: result.googleError?.code,
      googleMessage: result.googleError?.message
    })
  }

  const modelChain = verification
    .filter((result) => result.available)
    .map((result) => result.model)

  resolvedModelConfig = {
    configuredModel: MODEL,
    requestedModelChain: REQUESTED_MODEL_CHAIN,
    modelChain,
    verifiedAt: new Date().toISOString(),
    verification
  }

  logStep("gemini-model-resolution", "Resolved Gemini model chain", {
    requestId,
    configuredModel: MODEL,
    modelChain,
    skippedModels: verification
      .filter((result) => !result.available)
      .map((result) => ({
        model: result.model,
        httpStatus: result.googleError?.httpStatus,
        googleStatus: result.googleError?.code,
        message: result.googleError?.message
      }))
  })

  return resolvedModelConfig
}

async function callGeminiWithRetry({ requestPayload, step, model, timeoutMs, maxRetries = DEFAULT_MAX_RETRIES, requestId = "", onRetry }) {
  const startedAt = Date.now()
  const promptSize = String(requestPayload?.contents || "").length
  const totalRetryAttempts = Math.max(0, maxRetries)
  const maxAttempts = totalRetryAttempts + 1

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptStartedAt = Date.now()

    try {
      logStep(step, "Gemini request attempt started", {
        model,
        endpoint: ENDPOINT,
        requestId,
        attempt: attempt + 1,
        maxAttempts,
        timeoutMs,
        promptSize
      })

      const response = await client.models.generateContent(requestPayload)
      const elapsedMs = Date.now() - attemptStartedAt
      const responseText = String(response.text || "")

      logStep(step, "Gemini response received", {
        model,
        endpoint: ENDPOINT,
        requestId,
        attempt: attempt + 1,
        elapsedMs,
        httpStatus: response.sdkHttpResponse?.status,
        tokenUsage: response.usageMetadata,
        finishReason: response.candidates?.[0]?.finishReason || "",
        promptSize,
        responseSize: responseText.length,
        responseChars: responseText.length,
        hasText: Boolean(responseText.trim()),
        finalStatus: "success"
      })

      return response
    } catch (error) {
      const googleError = extractGoogleError(error)
      const classification = classifyGoogleError(googleError)
      const elapsedMs = Date.now() - attemptStartedAt
      const quotaExhausted = isQuotaGoogleError(googleError)
      const canRetry = classification.retryable && isRetryableGoogleError(googleError) && attempt < maxAttempts - 1

      logFailure(step, error, {
        model,
        endpoint: ENDPOINT,
        requestId,
        attempt: attempt + 1,
        elapsedMs,
        googleError,
        promptSize,
        quotaFailure: quotaExhausted,
        retryable: canRetry
      })

      if (!canRetry) {
        const wrapped = new GenerationStepError({
          step,
          reason: classification.reason,
          details: googleError,
          payload: {
            model,
            endpoint: ENDPOINT,
            requestId,
            attempt: attempt + 1,
            elapsedMs: Date.now() - startedAt,
            googleError,
            promptSize,
            finalStatus: "failed"
          },
          statusCode: classification.statusCode,
          retryable: classification.retryable,
          cause: error
        })
        wrapped.shouldFallbackModel = shouldFallbackModel(googleError)
        wrapped.quotaExhausted = quotaExhausted
        throw wrapped
      }

      const retryAttempt = attempt + 1
      const delayMs = retryDelayMs(attempt)
      logStep(step, "Retrying Gemini request after backoff", {
        model,
        endpoint: ENDPOINT,
        requestId,
        retryAttempt,
        maxRetries: totalRetryAttempts,
        nextAttempt: attempt + 2,
        delayMs,
        elapsedMs,
        googleStatus: googleError.code,
        httpStatus: googleError.httpStatus,
        networkCode: googleError.networkCode,
        retryReason: classification.reason,
        quotaFailure: quotaExhausted
      })
      await onRetry?.({
        step,
        model,
        requestId,
        retryAttempt,
        maxRetries: totalRetryAttempts,
        nextAttempt: attempt + 2,
        delayMs,
        reason: classification.reason,
        httpStatus: googleError.httpStatus,
        googleStatus: googleError.code,
        networkCode: googleError.networkCode,
        quotaFailure: quotaExhausted
      })
      await sleep(delayMs)
    }
  }
}

async function generateJson({ prompt, step, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES, requestId = "", onRetry }) {
  const effectiveRequestId = requestId || `adhoc_${Date.now()}_${Math.random().toString(16).slice(2)}`

  if (!client) {
    throw new GenerationStepError({
      step: "gemini:configuration",
      reason: "GOOGLE_GENAI_API_KEY is required.",
      statusCode: 500,
      retryable: false
    })
  }

  const estimatedTokens = Math.ceil(String(prompt || "").length / 4)

  if (estimatedTokens > 900000) {
    throw new GenerationStepError({
      step,
      reason: "Gemini prompt is too large.",
      payload: { estimatedTokens },
      retryable: false
    })
  }

  let lastError = null
  const modelConfig = await resolveModelConfig({ requestId: effectiveRequestId })
  const modelChain = modelConfig.modelChain
  const scopedModelChain = requestScopedModelChain(modelChain, effectiveRequestId)

  if (!modelChain.length) {
    throw new GenerationStepError({
      step,
      reason: "No verified Gemini model is available for this API key.",
      details: modelConfig.verification,
      payload: {
        endpoint: ENDPOINT,
        configuredModel: MODEL,
        verification: modelConfig.verification
      },
      statusCode: 503,
      retryable: true
    })
  }

  if (!scopedModelChain.length) {
    throw quotaExhaustedError({ step, requestId: effectiveRequestId, modelChain })
  }

  logStep(step, "Gemini model chain selected for request stage", {
    requestId: effectiveRequestId,
    configuredModel: MODEL,
    modelChain,
    scopedModelChain,
    preferredModel: getRequestModelState(effectiveRequestId).preferredModel,
    unavailableModels: Array.from(getRequestModelState(effectiveRequestId).unavailableModels)
  })

  for (const model of scopedModelChain) {
    const requestPayload = {
      model,
      contents: String(prompt || ""),
      config: {
        responseMimeType: "application/json",
        httpOptions: {
          timeout: timeoutMs
        }
      }
    }

    logStep(step, "Gemini request started", {
      model,
      endpoint: ENDPOINT,
      requestId: effectiveRequestId,
      requestPayload,
      promptChars: String(prompt || "").length,
      estimatedTokens,
      timeoutMs
    })

    try {
      const response = await callGeminiWithRetry({
        requestPayload,
        step,
        model,
        timeoutMs,
        maxRetries,
        requestId: effectiveRequestId,
        onRetry
      })

      markModelSuccessfulForRequest({ requestId: effectiveRequestId, model, step })
      const responseText = String(response.text || "")
      logStep(step, "Raw Gemini response diagnostics before JSON parsing", {
        requestId: effectiveRequestId,
        model,
        responseChars: responseText.length,
        ...summarizeRawJsonResponse(responseText)
      })
      return parseJsonOnly(responseText, `${step}:parse`)
    } catch (error) {
      lastError = error

      if (error instanceof GenerationStepError && error.shouldFallbackModel) {
        if (error.quotaExhausted) {
          markModelUnavailableForRequest({
            requestId: effectiveRequestId,
            model,
            step,
            googleError: error.payload?.googleError || error.googleError || {}
          })
        }

        logStep(step, "Trying next Gemini model", {
          failedModel: model,
          endpoint: ENDPOINT,
          requestId: effectiveRequestId,
          reason: error.reason,
          httpStatus: error.payload?.googleError?.httpStatus,
          googleStatus: error.payload?.googleError?.code
        })
        continue
      }

      if (error instanceof GenerationStepError) {
        throw error
      }

      throw new GenerationStepError({
        step,
        reason: error.message || "Gemini request failed.",
        details: error.stack,
        statusCode: 502,
        retryable: false,
        cause: error
      })
    }
  }

  if (lastError instanceof GenerationStepError && lastError.quotaExhausted) {
    throw quotaExhaustedError({ step, requestId: effectiveRequestId, modelChain })
  }

  throw lastError || new GenerationStepError({
    step,
    reason: "No Gemini model was available.",
    payload: {
      endpoint: ENDPOINT,
      modelChain
    },
    statusCode: 502,
    retryable: false
  })
}

async function streamText({ prompt, step, timeoutMs = DEFAULT_TIMEOUT_MS, requestId = "", onChunk }) {
  const effectiveRequestId = requestId || `stream_${Date.now()}_${Math.random().toString(16).slice(2)}`

  if (!client) {
    throw new GenerationStepError({
      step: "gemini:configuration",
      reason: "GOOGLE_GENAI_API_KEY is required.",
      statusCode: 500,
      retryable: false
    })
  }

  const estimatedTokens = Math.ceil(String(prompt || "").length / 4)

  if (estimatedTokens > 900000) {
    throw new GenerationStepError({
      step,
      reason: "Gemini prompt is too large.",
      payload: { estimatedTokens },
      retryable: false
    })
  }

  const modelConfig = await resolveModelConfig({ requestId: effectiveRequestId })
  const modelChain = modelConfig.modelChain
  const scopedModelChain = requestScopedModelChain(modelChain, effectiveRequestId)

  if (!modelChain.length) {
    throw new GenerationStepError({
      step,
      reason: "No verified Gemini model is available for this API key.",
      details: modelConfig.verification,
      payload: {
        endpoint: ENDPOINT,
        configuredModel: MODEL,
        verification: modelConfig.verification
      },
      statusCode: 503,
      retryable: true
    })
  }

  if (!scopedModelChain.length) {
    throw quotaExhaustedError({ step, requestId: effectiveRequestId, modelChain })
  }

  let lastError = null

  for (const model of scopedModelChain) {
    const requestPayload = {
      model,
      contents: String(prompt || ""),
      config: {
        httpOptions: {
          timeout: timeoutMs
        }
      }
    }
    const promptSize = String(requestPayload.contents || "").length
    const maxAttempts = DEFAULT_MAX_RETRIES + 1

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const attemptStartedAt = Date.now()
      let fullText = ""

      try {
        logStep(step, "Gemini streaming request attempt started", {
          model,
          endpoint: `${ENDPOINT}Stream`,
          requestId: effectiveRequestId,
          attempt: attempt + 1,
          maxAttempts,
          timeoutMs,
          promptSize
        })

        const stream = await client.models.generateContentStream(requestPayload)
        let firstChunkElapsedMs = null

        for await (const chunk of stream) {
          const chunkText = String(chunk?.text || "")
          if (!chunkText) continue

          if (firstChunkElapsedMs === null) {
            firstChunkElapsedMs = Date.now() - attemptStartedAt
            logStep(step, "Gemini streaming first chunk received", {
              model,
              endpoint: `${ENDPOINT}Stream`,
              requestId: effectiveRequestId,
              attempt: attempt + 1,
              firstChunkElapsedMs,
              promptSize
            })
          }

          fullText += chunkText
          onChunk?.(chunkText)
        }

        logStep(step, "Gemini streaming response completed", {
          model,
          endpoint: `${ENDPOINT}Stream`,
          requestId: effectiveRequestId,
          attempt: attempt + 1,
          elapsedMs: Date.now() - attemptStartedAt,
          firstChunkElapsedMs,
          promptSize,
          responseSize: fullText.length,
          responseChars: fullText.length,
          hasText: Boolean(fullText.trim()),
          finalStatus: "success"
        })

        markModelSuccessfulForRequest({ requestId: effectiveRequestId, model, step })
        return fullText
      } catch (error) {
        if (error instanceof GenerationStepError) {
          lastError = error

          if (error.shouldFallbackModel && !fullText) {
            if (error.quotaExhausted) {
              markModelUnavailableForRequest({
                requestId: effectiveRequestId,
                model,
                step,
                googleError: error.payload?.googleError || error.googleError || {}
              })
            }
            break
          }

          throw error
        }

        const googleError = extractGoogleError(error)
        const classification = classifyGoogleError(googleError)
        const quotaExhausted = isQuotaGoogleError(googleError)
        const canRetry = !fullText && classification.retryable && isRetryableGoogleError(googleError) && attempt < maxAttempts - 1
        const wrapped = new GenerationStepError({
          step,
          reason: classification.reason,
          details: googleError,
          payload: {
            model,
            endpoint: `${ENDPOINT}Stream`,
            requestId: effectiveRequestId,
            attempt: attempt + 1,
            elapsedMs: Date.now() - attemptStartedAt,
            googleError,
            promptSize,
            responseSize: fullText.length,
            finalStatus: "failed"
          },
          statusCode: classification.statusCode,
          retryable: classification.retryable,
          cause: error
        })
        wrapped.shouldFallbackModel = !fullText && shouldFallbackModel(googleError)
        wrapped.quotaExhausted = quotaExhausted
        lastError = wrapped

        logFailure(step, error, {
          model,
          endpoint: `${ENDPOINT}Stream`,
          requestId: effectiveRequestId,
          attempt: attempt + 1,
          elapsedMs: Date.now() - attemptStartedAt,
          googleError,
          promptSize,
          responseSize: fullText.length,
          quotaFailure: quotaExhausted,
          retryable: canRetry
        })

        if (canRetry) {
          const delayMs = retryDelayMs(attempt)
          logStep(step, "Retrying Gemini streaming request after backoff", {
            model,
            endpoint: `${ENDPOINT}Stream`,
            requestId: effectiveRequestId,
            retryAttempt: attempt + 1,
            maxRetries: DEFAULT_MAX_RETRIES,
            nextAttempt: attempt + 2,
            delayMs,
            googleStatus: googleError.code,
            httpStatus: googleError.httpStatus,
            networkCode: googleError.networkCode,
            retryReason: classification.reason,
            quotaFailure: quotaExhausted
          })
          await sleep(delayMs)
          continue
        }

        if (wrapped.shouldFallbackModel) {
          if (quotaExhausted) {
            markModelUnavailableForRequest({
              requestId: effectiveRequestId,
              model,
              step,
              googleError
            })
          }
          break
        }

        throw wrapped
      }
    }
  }

  if (lastError instanceof GenerationStepError && lastError.quotaExhausted) {
    throw quotaExhaustedError({ step, requestId: effectiveRequestId, modelChain })
  }

  throw lastError || new GenerationStepError({
    step,
    reason: "No Gemini model was available.",
    payload: {
      endpoint: ENDPOINT,
      modelChain
    },
    statusCode: 502,
    retryable: false
  })
}

module.exports = {
  generateJson,
  callGeminiWithRetry,
  streamText,
  hasApiKey,
  MODEL,
  MODEL_CHAIN: REQUESTED_MODEL_CHAIN,
  CANDIDATE_MODELS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  ENDPOINT,
  extractGoogleError,
  classifyGoogleError,
  isRetryableGoogleError,
  resolveModelConfig
}
