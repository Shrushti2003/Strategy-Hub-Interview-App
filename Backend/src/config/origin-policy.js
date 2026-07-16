const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1"])
const DEFAULT_LOCAL_PORTS = new Set(["3000", "3001"])
const DEFAULT_VERCEL_PROJECTS = [
  "strategy-hub-interview",
  "strategy-hub-interview-app"
]

function splitList(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeOrigin(value = "") {
  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return ""
  }
}

function hostnameProjectSlug(hostname = "") {
  const normalized = String(hostname || "").toLowerCase()
  if (!normalized.endsWith(".vercel.app")) {
    return ""
  }

  return normalized.replace(/\.vercel\.app$/, "")
}

function projectSlugFromOrigin(origin = "") {
  try {
    const url = new URL(origin)
    return hostnameProjectSlug(url.hostname)
  } catch {
    return ""
  }
}

function createOriginPolicy(env) {
  const configuredOrigins = [
    "https://strategy-hub-interview-app.vercel.app",
    ...splitList(env.FRONTEND_URL),
    ...splitList(env.NEXT_PUBLIC_APP_URL),
    ...splitList(env.ALLOWED_ORIGINS)
  ]
    .map(normalizeOrigin)
    .filter(Boolean)

  const exactOrigins = new Set([
    ...configuredOrigins,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ])

  const vercelProjects = new Set([
    ...DEFAULT_VERCEL_PROJECTS,
    ...configuredOrigins.map(projectSlugFromOrigin).filter(Boolean),
    ...splitList(env.VERCEL_ALLOWED_PROJECTS)
  ].map((project) => project.toLowerCase()))

  function isAllowedLocalhost(url) {
    return LOCALHOST_HOSTS.has(url.hostname) &&
      ["http:", "https:"].includes(url.protocol) &&
      DEFAULT_LOCAL_PORTS.has(url.port || (url.protocol === "https:" ? "443" : "80"))
  }

  function isAllowedVercelDeployment(url) {
    if (url.protocol !== "https:" || !url.hostname.endsWith(".vercel.app")) {
      return false
    }

    const deploymentSlug = hostnameProjectSlug(url.hostname)

    return Array.from(vercelProjects).some((project) =>
      deploymentSlug === project ||
      deploymentSlug.startsWith(`${project}-`) ||
      deploymentSlug.startsWith(`${project}-git-`)
    )
  }

  function isAllowedOrigin(origin = "") {
    const normalizedOrigin = normalizeOrigin(origin)
    if (!normalizedOrigin) return false
    if (exactOrigins.has(normalizedOrigin)) return true

    try {
      const url = new URL(normalizedOrigin)
      return isAllowedLocalhost(url) || isAllowedVercelDeployment(url)
    } catch {
      return false
    }
  }

  function describe() {
    return {
      exactOrigins: Array.from(exactOrigins),
      vercelProjects: Array.from(vercelProjects)
    }
  }

  return {
    isAllowedOrigin,
    describe
  }
}

module.exports = {
  createOriginPolicy
}
