const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const crypto = require("node:crypto")
const userModel = require("../models/user-model")
const interviewReportModel = require("../models/interview-report-model")
const localStore = require("../services/local-store")
const { sendPasswordResetEmail } = require("../services/email-service")
const { env } = require("../config/env")

const JWT_SECRET = env.JWT_SECRET
const PASSWORD_RESET_TOKEN_MINUTES = env.PASSWORD_RESET_TOKEN_MINUTES

function isDbConnected() {
  return mongoose.connection.readyState === 1
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  )
}

function toPublicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  }
}

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    secure: env.NODE_ENV === "production",
    path: "/"
  }
}

function clearAuthCookie(res) {
  res.clearCookie("token", authCookieOptions())
}

function sendAuthResponse(res, statusCode, user, message) {
  const token = createToken(user)

  res.cookie("token", token, {
    ...authCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000
  })

  return res.status(statusCode).json({
    message,
    user: toPublicUser(user)
  })
}

function sendAuthError(res, step, error) {
  const payload = {
    success: false,
    step,
    reason: error?.message || "Authentication request failed.",
    details: env.NODE_ENV === "production" ? "Unexpected authentication error." : error?.stack || String(error)
  }

  return res.status(500).json(payload)
}

function normalizeEmail(email = "") {
  return String(email).toLowerCase().trim()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePassword(password = "") {
  if (password.length < 8) {
    return "Password must be at least 8 characters"
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number"
  }

  return ""
}

function wasTokenIssuedBeforePasswordChange(decoded, user) {
  if (!decoded?.iat || !user?.passwordChangedAt) {
    return false
  }

  return decoded.iat * 1000 + 1000 < new Date(user.passwordChangedAt).getTime()
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex")
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000)
  }
}

/**
 *  @name registerUserController
 *  @description register a new user, expects username, email and password in the request body
 *  @access Public
 */
async function registerUserController(req, res) {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Please provide username, email and password"
      })
    }

    const normalizedUsername = username.trim()
    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      })
    }

    const passwordError = validatePassword(password)

    if (normalizedUsername.length < 2 || passwordError) {
      return res.status(400).json({
        message: normalizedUsername.length < 2 ? "Name must be at least 2 characters" : passwordError
      })
    }

    let isUserAlreadyExists = null

    if (isDbConnected()) {
      isUserAlreadyExists = await userModel.findOne({
        $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
      })
    } else {
      isUserAlreadyExists =
        localStore.findUserByEmail(normalizedEmail) ||
        localStore.findUserByUsername(normalizedUsername)
    }

    if (isUserAlreadyExists) {
      return res.status(400).json({
        message: "Account already exists with this email address or username"
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = isDbConnected()
      ? await userModel.create({
          username: normalizedUsername,
          email: normalizedEmail,
          password: hashedPassword
        })
      : localStore.createUser({
          username: normalizedUsername,
          email: normalizedEmail,
          password: hashedPassword
        })

    return sendAuthResponse(res, 201, user, "User registered successfully")
  } catch (error) {
    return sendAuthError(res, "auth:register", error)
  }
}

async function loginUserController(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password"
      })
    }

    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      })
    }

    const user = isDbConnected()
      ? await userModel.findOne({ email: normalizedEmail })
      : localStore.findUserByEmail(normalizedEmail)

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password"
      })
    }

    return sendAuthResponse(res, 200, user, "Login successful")
  } catch (error) {
    return sendAuthError(res, "auth:login", error)
  }
}

async function requestPasswordResetController(req, res) {
  try {
    const email = normalizeEmail(req.body.email)

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      })
    }

    const user = isDbConnected()
      ? await userModel.findOne({ email }).select("+passwordResetRequestedAt")
      : localStore.findUserByEmail(email)

    const responseMessage =
      "If an account exists for that email, a password reset link has been sent."

    if (!user) {
      return res.status(200).json({ message: responseMessage })
    }

    const requestedAt = user.passwordResetRequestedAt
      ? new Date(user.passwordResetRequestedAt).getTime()
      : 0

    if (Date.now() - requestedAt < 60 * 1000) {
      return res.status(429).json({
        message: "Please wait a minute before requesting another reset link."
      })
    }

    const { token, tokenHash, expiresAt } = createResetToken()
    const updates = {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
      passwordResetRequestedAt: new Date()
    }

    if (isDbConnected()) {
      await userModel.updateOne({ _id: user._id }, updates)
    } else {
      localStore.updateUserByEmail(email, {
        ...updates,
        passwordResetExpiresAt: expiresAt.toISOString(),
        passwordResetRequestedAt: updates.passwordResetRequestedAt.toISOString()
      })
    }

    await sendPasswordResetEmail({
      to: email,
      token,
      expiresInMinutes: PASSWORD_RESET_TOKEN_MINUTES,
      baseUrl: req.get("origin")
    })

    return res.status(200).json({ message: responseMessage })
  } catch (error) {
    return sendAuthError(res, "auth:request-password-reset", error)
  }
}

async function verifyPasswordResetTokenController(req, res) {
  try {
    const token = String(req.query.token || "").trim()

    if (!token || token.length < 32) {
      return res.status(400).json({
        message: "Password reset link is invalid"
      })
    }

    const tokenHash = hashResetToken(token)
    const user = isDbConnected()
      ? await userModel
          .findOne({ passwordResetTokenHash: tokenHash })
          .select("+passwordResetTokenHash +passwordResetExpiresAt")
      : localStore.findUserByPasswordResetTokenHash(tokenHash)

    if (!user || !user.passwordResetExpiresAt) {
      return res.status(400).json({
        message: "Password reset link is invalid or has already been used"
      })
    }

    if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
      return res.status(410).json({
        message: "Password reset link has expired. Request a new one."
      })
    }

    return res.status(200).json({
      message: "Password reset link is valid"
    })
  } catch (error) {
    return sendAuthError(res, "auth:verify-password-reset-token", error)
  }
}

async function resetPasswordController(req, res) {
  try {
    const token = String(req.body.token || "").trim()
    const password = String(req.body.password || "")
    const passwordError = validatePassword(password)

    if (!token || token.length < 32) {
      return res.status(400).json({
        message: "Password reset link is invalid"
      })
    }

    if (passwordError) {
      return res.status(400).json({
        message: passwordError
      })
    }

    const tokenHash = hashResetToken(token)
    const user = isDbConnected()
      ? await userModel
          .findOne({ passwordResetTokenHash: tokenHash })
          .select("+passwordResetTokenHash +passwordResetExpiresAt +password")
      : localStore.findUserByPasswordResetTokenHash(tokenHash)

    if (!user || !user.passwordResetExpiresAt) {
      return res.status(400).json({
        message: "Password reset link is invalid or has already been used"
      })
    }

    if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
      return res.status(410).json({
        message: "Password reset link has expired. Request a new one."
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const updates = {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordResetRequestedAt: null
    }

    if (isDbConnected()) {
      await userModel.updateOne({ _id: user._id }, updates)
    } else {
      localStore.updateUser(user._id, updates)
    }

    res.clearCookie("token", authCookieOptions())

    return res.status(200).json({
      message: "Password reset successfully. You can now sign in."
    })
  } catch (error) {
    return sendAuthError(res, "auth:reset-password", error)
  }
}

async function getMeController(req, res) {
  try {
    const token = req.cookies.token

    if (!token) {
      clearAuthCookie(res)
      return res.status(200).json({
        message: "No active session",
        user: null
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = isDbConnected()
      ? await userModel.findById(decoded.sub).select("-password")
      : localStore.findUserById(decoded.sub)

    if (!user || wasTokenIssuedBeforePasswordChange(decoded, user)) {
      clearAuthCookie(res)
      return res.status(200).json({
        message: "No active session",
        user: null
      })
    }

    return res.status(200).json({
      user: toPublicUser(user)
    })
  } catch (error) {
    clearAuthCookie(res)
    return res.status(200).json({
      message: "No active session",
      user: null
    })
  }
}

function logoutUserController(req, res) {
  res.clearCookie("token", authCookieOptions())

  return res.status(200).json({
    message: "Logout successful"
  })
}

async function updateAccountController(req, res) {
  try {
    const userId = req.user.id
    const username = req.body.username?.trim()
    const email = req.body.email?.toLowerCase().trim()

    if (!username || !email) {
      return res.status(400).json({
        message: "Name and email are required"
      })
    }

    if (username.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Enter a valid name and email address"
      })
    }

    let duplicateUser = null

    if (isDbConnected()) {
      duplicateUser = await userModel.findOne({
        _id: { $ne: userId },
        $or: [{ username }, { email }]
      })
    } else {
      const byEmail = localStore.findUserByEmail(email)
      const byUsername = localStore.findUserByUsername(username)
      duplicateUser =
        byEmail?._id !== userId ? byEmail : byUsername?._id !== userId ? byUsername : null
    }

    if (duplicateUser) {
      return res.status(400).json({
        message: "Another account already uses that email address or name"
      })
    }

    const user = isDbConnected()
      ? await userModel
          .findByIdAndUpdate(userId, { username, email }, { new: true })
          .select("-password")
      : localStore.updateUser(userId, { username, email })

    if (!user) {
      return res.status(404).json({
        message: "Account not found"
      })
    }

    return res.status(200).json({
      message: "Account updated successfully",
      user: toPublicUser(user)
    })
  } catch (error) {
    return sendAuthError(res, "auth:update-account", error)
  }
}

async function changePasswordController(req, res) {
  try {
    const userId = req.user.id
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required"
      })
    }

    const passwordError = validatePassword(newPassword)

    if (passwordError) {
      return res.status(400).json({
        message: passwordError
      })
    }

    const user = isDbConnected()
      ? await userModel.findById(userId)
      : localStore.findUserById(userId)

    if (!user) {
      return res.status(404).json({
        message: "Account not found"
      })
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Current password is incorrect"
      })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    let updatedUser = user

    if (isDbConnected()) {
      user.password = hashedPassword
      user.passwordChangedAt = new Date()
      updatedUser = await user.save()
    } else {
      updatedUser = localStore.updateUser(userId, {
        password: hashedPassword,
        passwordChangedAt: new Date().toISOString()
      })
    }

    return sendAuthResponse(res, 200, updatedUser, "Password updated successfully")
  } catch (error) {
    return sendAuthError(res, "auth:change-password", error)
  }
}

async function deleteAccountController(req, res) {
  try {
    const userId = req.user.id

    if (isDbConnected()) {
      await Promise.all([
        userModel.findByIdAndDelete(userId),
        interviewReportModel.deleteMany({ user: userId })
      ])
    } else {
      localStore.deleteUserAndData(userId)
    }

    res.clearCookie("token", authCookieOptions())

    return res.status(200).json({
      message: "Account deleted successfully"
    })
  } catch (error) {
    return sendAuthError(res, "auth:delete-account", error)
  }
}

module.exports = {
  registerUserController,
  loginUserController,
  requestPasswordResetController,
  verifyPasswordResetTokenController,
  resetPasswordController,
  getMeController,
  logoutUserController,
  updateAccountController,
  changePasswordController,
  deleteAccountController
}
