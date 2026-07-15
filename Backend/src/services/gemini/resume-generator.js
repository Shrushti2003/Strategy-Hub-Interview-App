const puppeteer = require("puppeteer")

function analyzeResumeStyle({ sampleResumeText = "" }) {
  const text = String(sampleResumeText || "")
  return {
    hasSample: Boolean(text.trim()),
    length: text.length,
    sectionOrder: text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z][A-Z\s/&-]{2,}$/.test(line))
      .slice(0, 12)
  }
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderList(items = []) {
  return (items || []).filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join("")
}

function renderResumeHtml(data = {}, plainTextFallback = "") {
  const personalInfo = data.personalInfo || {}
  const name = personalInfo.fullName || personalInfo.name || "Resume"
  const summary = data.summary || plainTextFallback || ""

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; margin: 36px; color: #1f2937; }
    h1 { margin: 0; font-size: 28px; }
    h2 { margin-top: 22px; border-bottom: 1px solid #9ca3af; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
    p, li { font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <p>${escapeHtml([personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean).join(" | "))}</p>
  <h2>Summary</h2>
  <p>${escapeHtml(summary)}</p>
  <h2>Technical Skills</h2>
  <ul>${renderList(data.technicalSkills || data.skills || [])}</ul>
  <h2>Projects</h2>
  <ul>${renderList((data.projects || []).map((project) => typeof project === "string" ? project : [project.name, project.description].filter(Boolean).join(": ")))}</ul>
  <h2>Experience</h2>
  <ul>${renderList((data.workExperience || data.experience || []).map((item) => typeof item === "string" ? item : [item.role, item.company, item.description].filter(Boolean).join(" - ")))}</ul>
  <h2>Achievements</h2>
  <ul>${renderList(data.achievements || [])}</ul>
</body>
</html>`
}

async function generateResumePdf({ atsResumeData = {}, plainTextFallback = "" }) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  })

  try {
    const page = await browser.newPage()
    await page.setContent(renderResumeHtml(atsResumeData, plainTextFallback), { waitUntil: "networkidle0" })
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    })
  } finally {
    await browser.close()
  }
}

module.exports = {
  analyzeResumeStyle,
  generateResumePdf
}
