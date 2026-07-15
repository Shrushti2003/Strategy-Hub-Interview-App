const nodemailer = require("nodemailer")
const { env } = require("../config/env")

const DEFAULT_FROM_NAME = "Strategy Hub"

function getBaseUrl(baseUrl) {
  const configuredUrl = env.FRONTEND_URL || env.NEXT_PUBLIC_APP_URL || baseUrl

  if (!configuredUrl) {
    throw new Error("Frontend URL is not configured for password reset emails")
  }

  return configuredUrl.replace(/\/+$/, "")
}

function buildResetUrl(token, baseUrl) {
  return `${getBaseUrl(baseUrl)}/reset-password?token=${encodeURIComponent(token)}`
}

function createTransporter() {
  const user = env.SMTP_USER
  const pass = env.SMTP_PASS

  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured")
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user,
      pass
    }
  })
}

function getFromAddress() {
  const user = env.SMTP_USER
  const from = env.EMAIL_FROM || user
  return from?.includes("<") ? from : `${DEFAULT_FROM_NAME} <${from}>`
}

async function sendPasswordResetEmail({ to, token, expiresInMinutes, baseUrl }) {
  const resetUrl = buildResetUrl(token, baseUrl)
  const transporter = createTransporter()
  const from = getFromAddress()
  const subject = "Reset your Strategy Hub password"
  const text = [
    "We received a request to reset your Strategy Hub password.",
    "",
    `Open this secure link within ${expiresInMinutes} minutes:`,
    resetUrl,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n")
  const html = `
    <div style="margin:0;background:#0b0f14;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e6eaf0;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(230,234,240,.12);border-radius:14px;background:#121821;box-shadow:0 24px 80px rgba(0,0,0,.35);overflow:hidden;">
        <div style="padding:28px 28px 8px;">
          <p style="margin:0 0 12px;color:#22d3ee;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Secure password reset</p>
          <h1 style="margin:0;color:#e6eaf0;font-size:26px;line-height:1.25;">Reset your Strategy Hub password</h1>
          <p style="margin:14px 0 0;color:#9aa4b2;font-size:15px;line-height:1.7;">Use the secure link below within ${expiresInMinutes} minutes to create a new password for your account.</p>
        </div>
        <div style="padding:20px 28px 28px;">
          <a href="${resetUrl}" style="display:inline-block;border-radius:10px;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;padding:13px 18px;box-shadow:0 0 28px rgba(124,58,237,.38);">Reset password</a>
          <p style="margin:22px 0 0;color:#9aa4b2;font-size:13px;line-height:1.6;">If the button does not work, paste this link into your browser:</p>
          <p style="margin:8px 0 0;word-break:break-all;color:#22d3ee;font-size:13px;line-height:1.6;">${resetUrl}</p>
          <p style="margin:22px 0 0;color:#9aa4b2;font-size:13px;line-height:1.6;">If you did not request this, you can safely ignore this email.</p>
        </div>
      </div>
    </div>
  `

  await transporter.sendMail({ from, to, subject, text, html })

  return { delivered: true }
}

module.exports = {
  sendPasswordResetEmail
}
