const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const userModel = require("../models/user-model")
const localStore = require("../services/local-store")
const { env } = require("../config/env")

const JWT_SECRET = env.JWT_SECRET

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    secure: env.NODE_ENV === "production"
  }
}

function clearAuthCookie(res) {
  res.clearCookie("token", authCookieOptions())
}

function wasTokenIssuedBeforePasswordChange(decoded, user) {
  if (!decoded?.iat || !user?.passwordChangedAt) {
    return false
  }

  return decoded.iat * 1000 + 1000 < new Date(user.passwordChangedAt).getTime()
}

async function authUser(req, res, next) {
  try {
    const token = req.cookies.token

    if (!token) {
      clearAuthCookie(res)
      return res.status(401).json({
        message: "Unauthorized"
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = mongoose.connection.readyState === 1
      ? await userModel.findById(decoded.sub).select("-password")
      : localStore.findUserById(decoded.sub)

    if (!user || wasTokenIssuedBeforePasswordChange(decoded, user)) {
      clearAuthCookie(res)
      return res.status(401).json({
        message: "Unauthorized"
      })
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      username: user.username
    }

    next()
  } catch (error) {
    clearAuthCookie(res)
    return res.status(401).json({
      message: "Unauthorized"
    })
  }
}

module.exports = {
  authUser
}
