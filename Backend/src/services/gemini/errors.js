const { sanitizeMessage } = require("../../config/env")

class GenerationStepError extends Error {
  constructor({ step, reason, details = "", payload = {}, statusCode = 502, retryable = false, cause }) {
    super(reason)
    this.name = "GenerationStepError"
    this.step = step
    this.reason = sanitizeMessage(reason)
    this.details = sanitizeMessage(
      typeof details === "string"
        ? details
        : JSON.stringify(details || cause?.stack || cause?.message || "")
    )
    this.payload = payload
    this.statusCode = statusCode
    this.retryable = retryable
    this.googleError = payload?.googleError
    this.cause = cause
  }
}

function safePayload(value, maxLength = 2000) {
  try {
    const sanitized = sanitizeMessage(JSON.stringify(value || {}, null, 2))
    if (sanitized.length <= maxLength) {
      return JSON.parse(sanitized)
    }

    return {
      truncated: true,
      originalLength: sanitized.length,
      preview: sanitized.slice(0, maxLength)
    }
  } catch {
    return sanitizeMessage(String(value || "")).slice(0, maxLength)
  }
}

function logStep(step, message, payload = {}) {
  console.log(`[generation:${step}] ${message}`, safePayload(payload))
}

function logFailure(step, error, payload = {}) {
  const googleError = error?.googleError || error?.payload?.googleError || payload?.googleError || {}
  const diagnostic = {
    step,
    reason: sanitizeMessage(error?.reason || error?.message || "Generation failed"),
    details: sanitizeMessage(error?.details || error?.stack || ""),
    httpStatus: googleError.httpStatus || error?.status,
    googleCode: googleError.code,
    googleMessage: sanitizeMessage(googleError.message || ""),
    googleDetails: safePayload(googleError.details || {}, 10000),
    apiResponseBody: safePayload(googleError.apiResponseBody || {}, 10000),
    retryable: error?.retryable,
    payload: safePayload(payload)
  }

  console.error(`[generation:${step}] failed`, diagnostic)
  return diagnostic
}

module.exports = {
  GenerationStepError,
  logFailure,
  logStep,
  safePayload
}
