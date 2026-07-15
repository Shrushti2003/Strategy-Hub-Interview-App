const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const dataDir = path.join(__dirname, "../../../.data")
const storePath = path.join(dataDir, "store.json")
const legacyStorePath = path.join(__dirname, "../../.data/store.json")

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (!fs.existsSync(storePath)) {
    if (fs.existsSync(legacyStorePath)) {
      fs.copyFileSync(legacyStorePath, storePath)
      return
    }

    fs.writeFileSync(
      storePath,
      JSON.stringify({ users: [], interviewReports: [] }, null, 2),
      "utf8"
    )
  }
}

function readStore() {
  ensureStore()
  return JSON.parse(fs.readFileSync(storePath, "utf8"))
}

function waitForFile(ms) {
  const buffer = new SharedArrayBuffer(4)
  const view = new Int32Array(buffer)
  Atomics.wait(view, 0, 0, ms)
}

function writeStore(data) {
  ensureStore()
  const payload = JSON.stringify(data, null, 2)
  let lastError = null

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.writeFileSync(storePath, payload, "utf8")
      return
    } catch (error) {
      lastError = error

      if (!["EPERM", "EACCES", "EBUSY"].includes(error.code)) {
        throw error
      }

      waitForFile(40 * (attempt + 1))
    }
  }

  throw lastError
}

function createId() {
  return crypto.randomUUID().replace(/-/g, "")
}

function findUserByEmail(email) {
  const store = readStore()
  return store.users.find((user) => user.email === email) || null
}

function findUserById(id) {
  const store = readStore()
  return store.users.find((user) => user._id === id) || null
}

function findUserByUsername(username) {
  const store = readStore()
  const normalizedUsername = username.toLowerCase().trim()
  return (
    store.users.find(
      (user) => user.username.toLowerCase().trim() === normalizedUsername
    ) || null
  )
}

function createUser(user) {
  const store = readStore()
  const record = {
    _id: createId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...user
  }
  store.users.push(record)
  writeStore(store)
  return record
}

function updateUser(userId, updates) {
  const store = readStore()
  const userIndex = store.users.findIndex((user) => user._id === userId)

  if (userIndex === -1) {
    return null
  }

  store.users[userIndex] = {
    ...store.users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  writeStore(store)
  return store.users[userIndex]
}

function updateUserByEmail(email, updates) {
  const store = readStore()
  const userIndex = store.users.findIndex((user) => user.email === email)

  if (userIndex === -1) {
    return null
  }

  store.users[userIndex] = {
    ...store.users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  writeStore(store)
  return store.users[userIndex]
}

function findUserByPasswordResetTokenHash(tokenHash) {
  const store = readStore()
  return store.users.find((user) => user.passwordResetTokenHash === tokenHash) || null
}

function createInterviewReport(report) {
  const store = readStore()
  const record = {
    _id: createId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...report
  }
  store.interviewReports.push(record)
  writeStore(store)
  return record
}

function findInterviewReportById(id, userId) {
  const store = readStore()
  return (
    store.interviewReports.find(
      (report) => report._id === id && report.user === userId
    ) || null
  )
}

function findInterviewReportsByUser(userId) {
  const store = readStore()
  return store.interviewReports
    .filter((report) => report.user === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

function updateInterviewReport(id, userId, updates) {
  const store = readStore()
  const reportIndex = store.interviewReports.findIndex(
    (report) => report._id === id && report.user === userId
  )

  if (reportIndex === -1) {
    return null
  }

  store.interviewReports[reportIndex] = {
    ...store.interviewReports[reportIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  writeStore(store)
  return store.interviewReports[reportIndex]
}

function deleteInterviewReport(id, userId) {
  const store = readStore()
  const initialReportCount = store.interviewReports.length

  store.interviewReports = store.interviewReports.filter(
    (report) => !(report._id === id && report.user === userId)
  )

  writeStore(store)
  return initialReportCount !== store.interviewReports.length
}

function deleteUserAndData(userId) {
  const store = readStore()
  const initialUserCount = store.users.length

  store.users = store.users.filter((user) => user._id !== userId)
  store.interviewReports = store.interviewReports.filter(
    (report) => report.user !== userId
  )

  writeStore(store)
  return initialUserCount !== store.users.length
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserByUsername,
  findUserByPasswordResetTokenHash,
  createUser,
  updateUser,
  updateUserByEmail,
  deleteUserAndData,
  createInterviewReport,
  findInterviewReportById,
  findInterviewReportsByUser,
  updateInterviewReport,
  deleteInterviewReport
}
