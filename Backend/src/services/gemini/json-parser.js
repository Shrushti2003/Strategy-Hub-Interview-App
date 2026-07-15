const { GenerationStepError, logStep } = require("./errors")

function stripMarkdownFences(value = "") {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}

function lineColumnAt(text, index) {
  const before = text.slice(0, Math.max(0, index))
  const lines = before.split(/\r?\n/)
  return {
    index,
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  }
}

function parseErrorPosition(error) {
  const match = String(error?.message || "").match(/position\s+(\d+)/i)
  return match ? Number(match[1]) : null
}

function snippetAround(text, index, radius = 240) {
  const start = Math.max(0, Number(index || 0) - radius)
  const end = Math.min(text.length, Number(index || 0) + radius)
  return text.slice(start, end)
}

function findBalancedJson(text = "") {
  const raw = String(text || "")
  const openers = new Set(["{", "["])
  const closers = {
    "{": "}",
    "[": "]"
  }

  for (let start = 0; start < raw.length; start += 1) {
    const first = raw[start]
    if (!openers.has(first)) continue

    const stack = [closers[first]]
    let inString = false
    let escaped = false

    for (let index = start + 1; index < raw.length; index += 1) {
      const char = raw[index]

      if (escaped) {
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = inString
        continue
      }

      if (char === "\"") {
        inString = !inString
        continue
      }

      if (inString) continue

      if (openers.has(char)) {
        stack.push(closers[char])
        continue
      }

      if (char === stack[stack.length - 1]) {
        stack.pop()

        if (!stack.length) {
          return raw.slice(start, index + 1)
        }
      }
    }
  }

  return ""
}

function parseJsonOnly(text, step = "json-parser") {
  const rawResponse = String(text || "")
  const raw = stripMarkdownFences(rawResponse)

  if (!raw) {
    throw new GenerationStepError({
      step,
      reason: "Gemini returned an empty response.",
      payload: {
        responseLength: 0,
        rawResponse
      }
    })
  }

  try {
    logStep(step, "JSON parsing started", { responseChars: raw.length })
    return JSON.parse(raw)
  } catch (error) {
    const extracted = findBalancedJson(raw)

    if (extracted) {
      try {
        logStep(step, "JSON parsing recovered from wrapped response", {
          responseChars: raw.length,
          extractedChars: extracted.length
        })
        return JSON.parse(extracted)
      } catch (extractedError) {
        const position = parseErrorPosition(extractedError)
        const diagnostics = {
          parserPosition: position === null ? null : lineColumnAt(extracted, position),
          responseLength: raw.length,
          extractedLength: extracted.length,
          snippet: snippetAround(extracted, position || 0),
          rawResponse
        }

        throw new GenerationStepError({
          step,
          reason: "Gemini returned invalid JSON.",
          details: diagnostics,
          payload: diagnostics,
          retryable: false,
          cause: extractedError
        })
      }
    }

    const position = parseErrorPosition(error)
    const diagnostics = {
      parserPosition: position === null ? null : lineColumnAt(raw, position),
      responseLength: raw.length,
      snippet: snippetAround(raw, position || 0),
      rawResponse
    }

    throw new GenerationStepError({
      step,
      reason: "Gemini returned invalid JSON.",
      details: diagnostics,
      payload: diagnostics,
      retryable: false,
      cause: error
    })
  }
}

module.exports = {
  parseJsonOnly,
  findBalancedJson
}
