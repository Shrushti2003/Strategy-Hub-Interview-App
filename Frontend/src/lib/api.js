import axios from "axios"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      error?.response?.status === 401 &&
      window.location.pathname.startsWith("/dashboard")
    ) {
      window.localStorage.removeItem("strategyhub.session")
      window.localStorage.removeItem("strategyhub.trustedDevice")
      window.location.replace("/login")
    }

    return Promise.reject(error)
  }
)

// Auth

export async function registerUser({ username, email, password }) {
  const res = await api.post("/api/auth/register", { username, email, password })
  return res.data
}

export async function loginUser({ email, password }) {
  const res = await api.post("/api/auth/login", { email, password })
  return res.data
}

export async function requestPasswordReset({ email }) {
  const res = await api.post("/api/auth/forgot-password", { email })
  return res.data
}

export async function verifyPasswordResetToken(token) {
  const res = await api.get("/api/auth/reset-password/verify", {
    params: { token },
  })
  return res.data
}

export async function resetPassword({ token, password }) {
  const res = await api.post("/api/auth/reset-password", { token, password })
  return res.data
}

export async function logoutUser() {
  const res = await api.post("/api/auth/logout")
  return res.data
}

export async function updateAccount(payload) {
  const res = await api.patch("/api/auth/account", payload)
  return res.data
}

export async function changePassword(payload) {
  const res = await api.patch("/api/auth/password", payload)
  return res.data
}

export async function deleteAccount() {
  const res = await api.delete("/api/auth/account")
  return res.data
}

export async function getMe() {
  const res = await api.get("/api/auth/get-me")
  return res.data
}

// Interview reports

export async function generateReport(formData) {
  const res = await api.post("/api/interview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data
}

export async function getReportById(id) {
  const res = await api.get(`/api/interview/report/${id}`)
  return res.data
}

export async function getAllReports() {
  const res = await api.get("/api/interview")
  return res.data
}

export async function deleteReport(id) {
  const res = await api.delete(`/api/interview/${id}`)
  return res.data
}

export async function updateQuestionState(id, payload) {
  const res = await api.put(`/api/interview/${id}/question-state`, payload)
  return res.data
}

export async function updateDashboardState(id, payload) {
  const res = await api.put(`/api/interview/${id}/dashboard-state`, payload)
  return res.data
}

export async function regenerateResumeBuilder(id) {
  const res = await api.post(`/api/interview/${id}/resume-builder`)
  return res.data
}

export async function exportReport(id, format = "json") {
  const res = await api.get(`/api/interview/export/${id}`, {
    params: { format },
    responseType: "blob",
  })
  return res.data
}

export async function downloadResumePdf(reportId) {
  const res = await api.post(`/api/interview/resume/pdf/${reportId}`, null, {
    responseType: "blob",
  })
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement("a")
  link.href = url
  link.download = `resume_${reportId}.pdf`
  link.click()
  window.URL.revokeObjectURL(url)
}

export async function downloadResumeBuilderPdf(payload) {
  const res = await api.post("/api/resume-export/pdf", payload, {
    responseType: "blob",
  })
  return res.data
}

export async function sendCareerChat(messages) {
  const res = await api.post("/api/interview/chat", { messages })
  return res.data
}

export async function streamCareerChat(messages, { onChunk, signal } = {}) {
  const response = await fetch(`${api.defaults.baseURL}/api/interview/chat`, {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({ messages }),
  })

  if (!response.ok) {
    if (
      typeof window !== "undefined" &&
      response.status === 401 &&
      window.location.pathname.startsWith("/dashboard")
    ) {
      window.localStorage.removeItem("strategyhub.session")
      window.localStorage.removeItem("strategyhub.trustedDevice")
      window.location.replace("/login")
    }

    let message = "Gemini could not answer right now. Please try again."
    try {
      const data = await response.json()
      message = data?.message || message
    } catch {
      const text = await response.text().catch(() => "")
      if (text) message = text
    }
    throw new Error(message)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("Streaming is not supported by this browser.")
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let reply = ""

  function handleEvent(rawEvent) {
    const lines = rawEvent.split("\n")
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message"
    const dataText = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")

    if (!dataText) return

    const data = JSON.parse(dataText)
    if (event === "chunk") {
      const text = data.text || ""
      reply += text
      onChunk?.(text, reply)
    }

    if (event === "done") {
      reply = data.reply || reply
    }

    if (event === "error") {
      throw new Error(data.message || "Gemini could not answer right now. Please try again.")
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() || ""
    events.forEach(handleEvent)
  }

  buffer += decoder.decode()
  if (buffer.trim()) handleEvent(buffer)

  return { reply }
}

export default api
