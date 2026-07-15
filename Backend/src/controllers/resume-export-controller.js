const puppeteer = require("puppeteer")

function sanitizeFileName(value = "Resume") {
  const cleaned = String(value)
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")

  return `${cleaned || "Resume"}.pdf`
}

function sanitizeResumeHtml(value = "") {
  return String(value)
    .replace(/<\s*(script|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s(on[a-z]+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("|\')\s*javascript:[\s\S]*?\2/gi, "")
}

function buildPdfDocument({ resumeHtml }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body {
        width: 210mm;
        margin: 0;
        background: #ffffff;
      }
      body {
        display: block;
      }
    </style>
  </head>
  <body>${sanitizeResumeHtml(resumeHtml)}</body>
</html>`
}

async function exportResumePdfController(req, res) {
  let browser

  try {
    const { resumeHtml, fileName } = req.body

    if (!resumeHtml || typeof resumeHtml !== "string") {
      return res.status(400).json({
        message: "Resume HTML is required"
      })
    }

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
    await page.setContent(
      buildPdfDocument({ resumeHtml }),
      { waitUntil: "load", timeout: 30000 }
    )

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm"
      }
    })

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${sanitizeFileName(fileName)}"`,
      "Content-Length": pdfBuffer.length
    })

    return res.send(pdfBuffer)
  } catch (error) {
    console.error("Resume PDF generation failed:", error.message)
    return res.status(500).json({
      success: false,
      step: "resume-export:pdf-generation",
      reason: error.message || "Unable to generate resume PDF.",
      details: process.env.NODE_ENV === "production" ? "Resume PDF export failed." : error.stack || String(error)
    })
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

module.exports = {
  exportResumePdfController
}
