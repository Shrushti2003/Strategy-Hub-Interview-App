const express = require("express")
const cookieParser = require("cookie-parser")
const authRouter = require("./routes/auth-routes")
const interviewRouter = require("./routes/interview-routes")
const resumeExportRouter = require("./routes/resume-export-routes")
const cors = require("cors")
const { env, sanitizeMessage } = require("./config/env")
const { geminiHealth } = require("./services/gemini/connectivity-audit")
const { createOriginPolicy } = require("./config/origin-policy")


const app = express()
const originPolicy = createOriginPolicy(env)
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const rateLimitBuckets = new Map()

console.log("Allowed origin policy:", originPolicy.describe())

function getRequestOrigin(req) {
  const origin = req.get("origin")
  if (origin) return origin

  const referer = req.get("referer")
  if (!referer) return ""

  try {
    return new URL(referer).origin
  } catch {
    return ""
  }
}

function enforceTrustedOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next()
  }

  const origin = getRequestOrigin(req)

  if (origin && !originPolicy.isAllowedOrigin(origin)) {
    return res.status(403).json({
      message: "Request origin is not allowed"
    })
  }

  return next()
}

function rateLimiter({ windowMs = 15 * 60 * 1000, max = 600 } = {}) {
  return (req, res, next) => {
    const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    const ip = forwardedFor.split(",")[0].trim() || req.ip || req.socket?.remoteAddress || "unknown"
    const key = `${ip}:${Math.floor(Date.now() / windowMs)}`
    const count = (rateLimitBuckets.get(key) || 0) + 1

    rateLimitBuckets.set(key, count)

    if (rateLimitBuckets.size > 10000) {
      const currentWindow = Math.floor(Date.now() / windowMs)
      for (const bucketKey of rateLimitBuckets.keys()) {
        if (!bucketKey.endsWith(`:${currentWindow}`)) {
          rateLimitBuckets.delete(bucketKey)
        }
      }
    }

    if (count > max) {
      res.setHeader("Retry-After", Math.ceil(windowMs / 1000))
      return res.status(429).json({
        message: "Too many requests. Please try again shortly."
      })
    }

    return next()
  }
}

app.set("trust proxy", 1)
app.use(express.json({ limit: "8mb" }))
app.use(cookieParser())
app.disable("x-powered-by")
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  next()
})
app.use(cors({
  origin(origin, callback) {
    if (!origin || originPolicy.isAllowedOrigin(origin)) {
      return callback(null, true)
    }

    const error = new Error(`Origin ${origin} is not allowed by CORS`)
    error.status = 403
    return callback(error)
  },
  credentials: true
}))
app.use(enforceTrustedOrigin)
app.use(rateLimiter())

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Backend server is running",
    availableRoutes: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      health: "GET /health"
    }
  })
})

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  })
})

app.get("/api/health/gemini", async (req, res) => {
  const health = await geminiHealth()
  res.status(health.connectivity ? 200 : 503).json(health)
})

app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/resume-export", resumeExportRouter)

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  })
})

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500
  const isMulterError = err.name === "MulterError"
  const message = isMulterError
    ? "Upload a PDF, DOC, DOCX, or TXT file under 5MB"
    : sanitizeMessage(err.message || "Request failed")

  res.status(isMulterError ? 400 : statusCode).json({
    success: false,
    step: err.step || "express:error-middleware",
    reason: err.reason || message,
    details: sanitizeMessage(err.details || err.stack || ""),
    message
  })
})

module.exports = app
