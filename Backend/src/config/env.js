const path = require("node:path")
const dotenv = require("dotenv")

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true })

function readEnv(name) {
  const value = process.env[name]
  return typeof value === "string" ? value.trim() : ""
}

function requireEnv(name, errors) {
  const value = readEnv(name)

  if (!value) {
    errors.push(`${name} is required`)
  }

  return value
}

function requireGroup(names, errors) {
  const hasAnyValue = names.some((name) => Boolean(readEnv(name)))

  if (!hasAnyValue) {
    return
  }

  for (const name of names) {
    requireEnv(name, errors)
  }
}

function maskSecret(value = "") {
  if (!value) {
    return "<empty>"
  }

  if (value.length <= 8) {
    return "<masked>"
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function sanitizeMessage(message = "") {
  let sanitized = String(message)

  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 6) {
      continue
    }

    if (/(SECRET|TOKEN|PASSWORD|PASS|KEY|URI|USER|EMAIL)/i.test(name)) {
      sanitized = sanitized.split(value).join(maskSecret(value))
    }
  }

  return sanitized
}

function validateEnv() {
  const errors = []
  const nodeEnv = readEnv("NODE_ENV") || "development"

  requireEnv("JWT_SECRET", errors)

  if (readEnv("JWT_SECRET") === "gen-ai-dev-secret") {
    errors.push("JWT_SECRET must not use the old development fallback value")
  }

  requireGroup(["SMTP_USER", "SMTP_PASS"], errors)

  if (nodeEnv === "production") {
    requireEnv("MONGO_URI", errors)
    requireEnv("FRONTEND_URL", errors)
    requireEnv("GOOGLE_GENAI_API_KEY", errors)
    requireEnv("SMTP_USER", errors)
    requireEnv("SMTP_PASS", errors)
    requireEnv("EMAIL_FROM", errors)
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join("; ")}`)
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(readEnv("PORT") || 3001),
    MONGO_URI: readEnv("MONGO_URI"),
    JWT_SECRET: readEnv("JWT_SECRET"),
    GOOGLE_GENAI_API_KEY: readEnv("GOOGLE_GENAI_API_KEY"),
    GEMINI_MODEL: readEnv("GEMINI_MODEL"),
    FRONTEND_URL: readEnv("FRONTEND_URL"),
    NEXT_PUBLIC_APP_URL: readEnv("NEXT_PUBLIC_APP_URL"),
    ALLOWED_ORIGINS: readEnv("ALLOWED_ORIGINS"),
    VERCEL_ALLOWED_PROJECTS: readEnv("VERCEL_ALLOWED_PROJECTS"),
    SMTP_HOST: readEnv("SMTP_HOST") || "smtp.gmail.com",
    SMTP_PORT: Number(readEnv("SMTP_PORT") || 465),
    SMTP_SECURE: String(readEnv("SMTP_SECURE") || "true") === "true",
    SMTP_USER: readEnv("SMTP_USER"),
    SMTP_PASS: readEnv("SMTP_PASS"),
    EMAIL_FROM: readEnv("EMAIL_FROM"),
    PASSWORD_RESET_TOKEN_MINUTES: Number(readEnv("PASSWORD_RESET_TOKEN_MINUTES") || 15)
  }
}

const env = validateEnv()

module.exports = {
  env,
  maskSecret,
  sanitizeMessage
}
