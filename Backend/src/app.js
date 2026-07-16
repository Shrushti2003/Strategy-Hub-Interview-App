const express = require("express")
const cookieParser = require("cookie-parser")
const authRouter = require("./routes/auth-routes")
const interviewRouter = require("./routes/interview-routes")
const resumeExportRouter = require("./routes/resume-export-routes")
const cors = require("cors")
const { env, sanitizeMessage } = require("./config/env")
const { geminiHealth } = require("./services/gemini/connectivity-audit")


const app = express()
const allowedOrigins = new Set([
  "https://strategy-hub-interview-app.vercel.app",

  env.FRONTEND_URL,
  env.NEXT_PUBLIC_APP_URL,

  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
].filter(Boolean))

console.log("Allowed Origins:", [...allowedOrigins]);

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
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next()
  }

  const origin = getRequestOrigin(req)
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({
      message: "Request origin is not allowed"
    })
  }

  return next()
}

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
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true)
    }

    const error = new Error(`Origin ${origin} is not allowed by CORS`)
    error.status = 403
    return callback(error)
  },
  credentials: true
}))
app.use(enforceTrustedOrigin)

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
