const { PDFParse } = require("pdf-parse")
const yauzl = require("yauzl")
const mongoose = require("mongoose")
const { analyzeResumeStyle, generateCareerChatResponse, generateInterviewReport, regenerateResumeBuilder, generateResumePdf, streamCareerChatResponse } = require("../services/ai-service")
const interviewReportModel = require("../models/interview-report-model")
const localStore = require("../services/local-store")
const { sanitizeMessage } = require("../config/env")
const { GenerationStepError } = require("../services/gemini/errors")
const { normalizeAtsResumeData } = require("../services/gemini/ats-generator")
const { logPipelineSnapshot } = require("../services/gemini/pipeline-snapshot")

function isDbConnected() {
    return mongoose.connection.readyState === 1
}

function normalizeQuestionState(questionState = {}) {
    if (questionState instanceof Map) {
        return Object.fromEntries(questionState)
    }

    return questionState || {}
}

function safePayload(value, maxLength = 2000) {
    try {
        return JSON.parse(sanitizeMessage(JSON.stringify(value || {}, null, 2)).slice(0, maxLength))
    } catch {
        return sanitizeMessage(String(value || "")).slice(0, maxLength)
    }
}

function stackLocation(error) {
    const stack = error?.stack || new Error().stack || ""
    const match = stack.match(/((?:[A-Za-z]:\\|\/).+\.js):(\d+):(\d+)/) ||
        stack.match(/at (?:async )?.*\((.+\.js):(\d+):(\d+)\)/) ||
        stack.match(/at (.+\.js):(\d+):(\d+)/)

    return {
        file: match?.[1] || "unknown",
        line: match?.[2] ? Number(match[2]) : null,
        column: match?.[3] ? Number(match[3]) : null
    }
}

function logGenerationStep(step, message, payload = {}) {
    console.log(`[interview:${step}] ${message}`, safePayload(payload))
}

function timingPayload(startedAt, extra = {}) {
    const endedAt = Date.now()
    return {
        startTime: new Date(startedAt).toISOString(),
        endTime: new Date(endedAt).toISOString(),
        durationMs: endedAt - startedAt,
        ...extra
    }
}

async function timedGenerationStage(step, message, task, extra = {}) {
    const startedAt = Date.now()
    logGenerationStep(step, `${message} started`, {
        startTime: new Date(startedAt).toISOString(),
        ...extra
    })

    try {
        const result = await task()
        logGenerationStep(step, `${message} completed`, timingPayload(startedAt, extra))
        return result
    } catch (error) {
        logGenerationStep(step, `${message} failed`, timingPayload(startedAt, {
            ...extra,
            errorMessage: error?.message || error?.reason || "Unknown error"
        }))
        throw error
    }
}

function runDetached(task) {
    setImmediate(() => {
        task().catch((error) => {
            logGenerationFailure("background-job:unhandled", error)
        })
    })
}

function logGenerationFailure(step, error, payload = {}) {
    const location = stackLocation(error)
    const diagnostic = {
        filename: location.file,
        function: step,
        line: location.line,
        errorMessage: sanitizeMessage(error?.message || "Unknown error"),
        stack: sanitizeMessage(error?.stack || ""),
        failingPayload: safePayload(payload)
    }

    console.error(`[interview:${step}] failed`, diagnostic)

    return diagnostic
}

function normalizeExtractedText(value = "") {
    return String(value || "")
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[\u2022\u25CF\u25E6\u2219]/g, "-")
        .replace(/[ \t\f\v]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function decodeXmlEntities(value = "") {
    return String(value || "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
}

function uploadDiagnostics(file) {
    return {
        filename: file?.originalname || "",
        fieldname: file?.fieldname || "",
        mimetype: file?.mimetype || "",
        size: Number(file?.size || 0),
        bufferLength: Buffer.isBuffer(file?.buffer) ? file.buffer.length : 0,
        hasPath: Boolean(file?.path),
        path: file?.path || "",
        tempFileExists: file?.path ? require("node:fs").existsSync(file.path) : false
    }
}

function unsupportedUploadError(file, diagnostics) {
    return new GenerationStepError({
        step: "request:file-extraction",
        reason: `Unsupported resume format for ${file?.originalname || "uploaded file"}. Upload a PDF or DOCX file.`,
        statusCode: 400,
        retryable: false,
        payload: diagnostics
    })
}

async function extractPdfText(file, diagnostics) {
    let parser

    try {
        parser = new PDFParse({ data: file.buffer })
        const result = await parser.getText()
        const text = normalizeExtractedText(result?.text || "")

        logGenerationStep("request:file-extraction", "PDF parser completed", {
            ...diagnostics,
            pages: result?.total || result?.pages?.length || null,
            extractedChars: text.length
        })

        if (!text) {
            throw new GenerationStepError({
                step: "request:file-extraction",
                reason: `Could not extract text from ${file.originalname || "uploaded PDF"}.`,
                details: "PDF parser completed but extracted 0 characters.",
                statusCode: 422,
                retryable: false,
                payload: {
                    ...diagnostics,
                    pages: result?.total || result?.pages?.length || null,
                    extractedChars: 0
                }
            })
        }

        return text
    } finally {
        if (parser) {
            await parser.destroy()
        }
    }
}

function readZipEntry(buffer, entryName) {
    return new Promise((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (openError, zipfile) => {
            if (openError) {
                reject(openError)
                return
            }

            let settled = false

            function finish(error, value = "") {
                if (settled) return
                settled = true
                zipfile.close()
                if (error) reject(error)
                else resolve(value)
            }

            zipfile.readEntry()
            zipfile.on("entry", (entry) => {
                if (entry.fileName !== entryName) {
                    zipfile.readEntry()
                    return
                }

                zipfile.openReadStream(entry, (streamError, stream) => {
                    if (streamError) {
                        finish(streamError)
                        return
                    }

                    const chunks = []
                    stream.on("data", (chunk) => chunks.push(chunk))
                    stream.on("error", finish)
                    stream.on("end", () => finish(null, Buffer.concat(chunks).toString("utf8")))
                })
            })
            zipfile.on("end", () => finish(null, ""))
            zipfile.on("error", finish)
        })
    })
}

async function extractDocxText(file, diagnostics) {
    const documentXml = await readZipEntry(file.buffer, "word/document.xml")

    if (!documentXml) {
        throw new GenerationStepError({
            step: "request:file-extraction",
            reason: `Could not extract text from ${file.originalname || "uploaded DOCX"}.`,
            details: "DOCX archive did not contain word/document.xml.",
            statusCode: 422,
            retryable: false,
            payload: diagnostics
        })
    }

    const parts = []
    const tokenPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<\/w:p>/g
    let match

    while ((match = tokenPattern.exec(documentXml))) {
        if (match[1] != null) {
            parts.push(decodeXmlEntities(match[1]))
        } else if (match[0].startsWith("<w:tab")) {
            parts.push("\t")
        } else {
            parts.push("\n")
        }
    }
    const text = normalizeExtractedText(parts.join(" "))

    logGenerationStep("request:file-extraction", "DOCX parser completed", {
        ...diagnostics,
        extractedChars: text.length
    })

    if (!text) {
        throw new GenerationStepError({
            step: "request:file-extraction",
            reason: `Could not extract text from ${file.originalname || "uploaded DOCX"}.`,
            details: "DOCX parser completed but extracted 0 characters.",
            statusCode: 422,
            retryable: false,
            payload: {
                ...diagnostics,
                extractedChars: 0
            }
        })
    }

    return text
}

function sendGenerationError(res, step, error, payload = {}) {
    const diagnostic = logGenerationFailure(step, error, payload)
    const statusCode = error?.statusCode || error?.status || 500
    const reason = sanitizeMessage(error?.reason || error?.message || "Interview generation failed.")

    return res.status(statusCode).json({
        success: false,
        step: error?.step || step,
        reason,
        details: sanitizeMessage(error?.details || diagnostic.stack || ""),
        message: reason,
        filename: diagnostic.filename,
        line: diagnostic.line,
        payload: safePayload(error?.payload || payload)
    })
}

function questionStateUpdate({ currentState = {}, questionKey, completed, bookmarked }) {
    const normalizedState = normalizeQuestionState(currentState)
    const previous = normalizedState[questionKey] || {}

    return {
        ...normalizedState,
        [questionKey]: {
            completed:
                typeof completed === "boolean" ? completed : Boolean(previous.completed),
            bookmarked:
                typeof bookmarked === "boolean" ? bookmarked : Boolean(previous.bookmarked)
        }
    }
}

function reportToMarkdown(interviewReport) {
    const report = interviewReport.toObject ? interviewReport.toObject() : interviewReport
    const lines = [
        `# ${report.title || "Interview Strategy"}`,
        "",
        report.jobTitle ? `Job Title: ${report.jobTitle}` : "",
        report.company ? `Company: ${report.company}` : "",
        report.jobTitle || report.company ? "" : "",
        `Match Score: ${report.matchScore || 0}%`,
        "",
        "## Skill Gaps",
        ...(report.skillGaps || []).map((gap) => `- ${gap.skill} (${gap.severity})`),
        "",
        "## Technical Questions",
        ...(report.technicalQuestions || []).map((item) => `- ${item.question}\n  - Answer: ${item.answer}`),
        "",
        "## Behavioral Questions",
        ...(report.behavioralQuestions || []).map((item) => `- ${item.question}\n  - Answer: ${item.answer}`),
        "",
        "## Roadmap",
        ...(report.preparationPlan || []).map((day) => `- Day ${day.day}: ${day.focus}\n  - ${(day.tasks || []).join("\n  - ")}`)
    ]

    return lines.join("\n")
}

async function createInterviewReportRecord(payload) {
    return isDbConnected()
        ? interviewReportModel.create(payload)
        : localStore.createInterviewReport(payload)
}

async function updateInterviewReportRecord(reportId, userId, updates) {
    return isDbConnected()
        ? interviewReportModel.findOneAndUpdate(
            { _id: reportId, user: userId },
            { $set: updates },
            { returnDocument: "after", runValidators: true }
        )
        : localStore.updateInterviewReport(String(reportId), String(userId), updates)
}

async function findInterviewReportRecord(reportId, userId) {
    return isDbConnected()
        ? interviewReportModel.findOne({ _id: reportId, user: userId })
        : localStore.findInterviewReportById(String(reportId), String(userId))
}

function publicReportSummary(report) {
    const value = report?.toObject ? report.toObject() : report

    return {
        _id: value?._id,
        title: value?.title,
        jobTitle: value?.jobTitle,
        company: value?.company,
        matchScore: value?.matchScore || 0,
        generationStatus: value?.generationStatus || "completed",
        generationStage: value?.generationStage || "",
        generationError: value?.generationError || {},
        generationStartedAt: value?.generationStartedAt,
        generationCompletedAt: value?.generationCompletedAt,
        generationFailedAt: value?.generationFailedAt,
        generationDurationMs: value?.generationDurationMs || 0,
        createdAt: value?.createdAt,
        updatedAt: value?.updatedAt
    }
}

function serializeJobError(error) {
    const isQuotaError = Number(error?.statusCode || error?.status) === 429 ||
        String(error?.payload?.googleError?.code || error?.googleError?.code || "").toUpperCase() === "RESOURCE_EXHAUSTED" ||
        /quota|RESOURCE_EXHAUSTED|rate limit/i.test(String(error?.reason || error?.message || error?.details || ""))
    const fallbackMessage = isQuotaError
        ? "Gemini quota exceeded. Please try again later."
        : "Interview generation failed."

    return {
        message: sanitizeMessage(isQuotaError ? fallbackMessage : (error?.message || fallbackMessage)),
        reason: sanitizeMessage(isQuotaError ? fallbackMessage : (error?.reason || error?.message || fallbackMessage)),
        details: sanitizeMessage(error?.details || error?.stack || ""),
        step: sanitizeMessage(error?.step || "interview-generation"),
        timestamp: new Date()
    }
}

function nonEmptyObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
}

function assertCompleteGeneratedReport(report = {}, stage = "generated-report") {
    const errors = []
    const technicalQuestions = Array.isArray(report.technicalQuestions) ? report.technicalQuestions : []
    const behavioralQuestions = Array.isArray(report.behavioralQuestions) ? report.behavioralQuestions : []
    const resumeQuestions = Array.isArray(report.resumeQuestions) ? report.resumeQuestions : []
    const roadmap = Array.isArray(report.roadmap || report.preparationPlan)
        ? report.roadmap || report.preparationPlan
        : []

    if (Number(report.matchScore || 0) <= 0) errors.push("matchScore must be greater than 0.")
    if (technicalQuestions.length < 20) errors.push(`technicalQuestions requires 20 items; received ${technicalQuestions.length}.`)
    if (behavioralQuestions.length < 10) errors.push(`behavioralQuestions requires 10 items; received ${behavioralQuestions.length}.`)
    if (resumeQuestions.length < 10) errors.push(`resumeQuestions requires 10 items; received ${resumeQuestions.length}.`)
    if (!roadmap.length) errors.push("roadmap/preparationPlan is empty.")
    if (!nonEmptyObject(report.strategy)) errors.push("strategy is empty.")
    if (!nonEmptyObject(report.atsAnalysis)) errors.push("atsAnalysis is empty.")
    if (!nonEmptyObject(report.resumeBuilder) || report.resumeBuilder?.status === "unavailable") errors.push("resumeBuilder is empty.")
    if (!Array.isArray(report.skillGaps) || report.skillGaps.length === 0) errors.push("skillGaps is empty.")

    const questionGroups = [
        ["technicalQuestions", technicalQuestions],
        ["behavioralQuestions", behavioralQuestions],
        ["resumeQuestions", resumeQuestions]
    ]

    for (const [groupName, questions] of questionGroups) {
        questions.forEach((question, index) => {
            if (!String(question?.question || "").trim()) errors.push(`${groupName}[${index}] is missing question.`)
            if (!String(question?.answer || question?.detailedAnswer || "").trim()) errors.push(`${groupName}[${index}] is missing answer.`)
            if (!String(question?.whyInterviewerAsks || question?.intention || "").trim()) errors.push(`${groupName}[${index}] is missing whyInterviewerAsks/intention.`)
            if (!Array.isArray(question?.followUps) || question.followUps.length === 0) errors.push(`${groupName}[${index}] is missing followUps.`)
            if (!Array.isArray(question?.bestPractices) || question.bestPractices.length === 0) errors.push(`${groupName}[${index}] is missing bestPractices.`)
            if (!Array.isArray(question?.evaluation) || question.evaluation.length === 0) errors.push(`${groupName}[${index}] is missing evaluation.`)
            if (!Array.isArray(question?.recruiterTips) || question.recruiterTips.length === 0) errors.push(`${groupName}[${index}] is missing recruiterTips/coaching.`)
            if (groupName === "behavioralQuestions" && !nonEmptyObject(question?.star)) errors.push(`${groupName}[${index}] is missing STAR answer.`)
        })
    }

    if (errors.length) {
        throw new GenerationStepError({
            step: `completion-validation:${stage}`,
            reason: "Generated interview report is incomplete and was not marked completed.",
            details: errors.join("\n"),
            payload: {
                errors,
                matchScore: report.matchScore,
                technicalQuestions: technicalQuestions.length,
                behavioralQuestions: behavioralQuestions.length,
                resumeQuestions: resumeQuestions.length,
                roadmapDays: roadmap.length,
                hasStrategy: nonEmptyObject(report.strategy),
                hasAtsAnalysis: nonEmptyObject(report.atsAnalysis),
                hasResumeBuilder: nonEmptyObject(report.resumeBuilder)
            },
            statusCode: 422,
            retryable: false
        })
    }
}

async function extractTextFromFile(file) {
    if (!file) {
        return ""
    }

    const diagnostics = uploadDiagnostics(file)
    logGenerationStep("request:file-extraction", "Upload received for extraction", diagnostics)

    if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
        throw new GenerationStepError({
            step: "request:file-extraction",
            reason: `Uploaded file ${file.originalname || "resume"} is empty.`,
            details: "Multer received the file, but the in-memory buffer is empty.",
            statusCode: 400,
            retryable: false,
            payload: diagnostics
        })
    }

    if (file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname || "")) {
        try {
            return await extractPdfText(file, diagnostics)
        } catch (error) {
            if (error instanceof GenerationStepError) throw error
            throw new GenerationStepError({
                step: "request:file-extraction",
                reason: `PDF parser failed for ${file.originalname || "uploaded PDF"}.`,
                details: error.stack || error.message,
                statusCode: 422,
                retryable: false,
                payload: {
                    ...diagnostics,
                    parserError: error.message
                },
                cause: error
            })
        }
    }

    if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        /\.docx$/i.test(file.originalname || "")
    ) {
        try {
            return await extractDocxText(file, diagnostics)
        } catch (error) {
            if (error instanceof GenerationStepError) throw error
            throw new GenerationStepError({
                step: "request:file-extraction",
                reason: `DOCX parser failed for ${file.originalname || "uploaded DOCX"}.`,
                details: error.stack || error.message,
                statusCode: 422,
                retryable: false,
                payload: {
                    ...diagnostics,
                    parserError: error.message
                },
                cause: error
            })
        }
    }

    if (file.mimetype === "text/plain" || /\.txt$/i.test(file.originalname || "")) {
        const text = normalizeExtractedText(file.buffer.toString("utf8"))
        logGenerationStep("request:file-extraction", "Plain text resume normalized", {
            ...diagnostics,
            extractedChars: text.length
        })

        if (!text) {
            throw new GenerationStepError({
                step: "request:file-extraction",
                reason: `Could not extract text from ${file.originalname || "uploaded text file"}.`,
                details: "Plain text upload decoded but contained 0 characters.",
                statusCode: 422,
                retryable: false,
                payload: {
                    ...diagnostics,
                    extractedChars: 0
                }
            })
        }

        return text
    }

    throw unsupportedUploadError(file, diagnostics)
}



/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
    const totalStartedAt = Date.now()
    const { selfDescription, jobDescription } = req.body
    const resumeFile = req.files?.resume?.[0] || null
    const styleResumeFile = req.files?.styleResume?.[0] || null
    const normalizedSelfDescription = normalizeExtractedText(selfDescription)
    const normalizedJobDescription = normalizeExtractedText(jobDescription)
    const requestPayload = {
        userId: req.user?.id,
        jobDescriptionChars: normalizedJobDescription.length,
        selfDescriptionChars: normalizedSelfDescription.length,
        hasResume: Boolean(resumeFile),
        hasStyleResume: Boolean(styleResumeFile),
        bodyKeys: Object.keys(req.body || {}),
        fileFields: Object.keys(req.files || {})
    }

    logGenerationStep("request", "Request received", {
        ...requestPayload,
        resumeFile: uploadDiagnostics(resumeFile),
        styleResumeFile: uploadDiagnostics(styleResumeFile)
    })

    if (!normalizedJobDescription) {
        return res.status(400).json({
            success: false,
            step: "request:validation",
            reason: "Job description is required.",
            message: "Job description is required."
        })
    }

    if (!resumeFile && !normalizedSelfDescription) {
        return res.status(400).json({
            success: false,
            step: "request:validation",
            reason: "Either resume or self description is required.",
            message: "Either resume or self description is required."
        })
    }

    try {
        const interviewReport = await timedGenerationStage("performance", "Processing report creation", () => createInterviewReportRecord({
            user: req.user.id,
            title: "Interview strategy is being generated",
            jobTitle: "",
            company: "",
            resume: "",
            styleResumeText: "",
            resumeStyleProfile: {},
            selfDescription: normalizedSelfDescription,
            jobDescription: normalizedJobDescription,
            questionState: {},
            dashboardState: {},
            matchScore: 0,
            technicalQuestions: [],
            behavioralQuestions: [],
            resumeQuestions: [],
            skillGaps: [],
            preparationPlan: [],
            roadmap: [],
            strategy: {},
            atsAnalysis: {},
            resumeBuilder: {},
            resumeSuggestions: [],
            atsResumeData: {},
            generationStatus: "processing",
            generationStage: "queued",
            generationError: {},
            generationStartedAt: new Date(),
            generationWarnings: []
        }), {
            dbConnected: isDbConnected(),
            userId: req.user.id
        })

        const reportId = interviewReport._id
        const userSnapshot = {
            id: req.user.id,
            _id: req.user._id,
            username: req.user.username,
            name: req.user.name,
            email: req.user.email
        }

        runDetached(() => processInterviewReportJob({
            reportId,
            userId: req.user.id,
            user: userSnapshot,
            resumeFile,
            styleResumeFile,
            normalizedSelfDescription,
            normalizedJobDescription,
            requestPayload,
            totalStartedAt
        }))

        logGenerationStep("response", "Processing response sent", {
            reportId,
            status: "processing",
            responseRuntimeMs: Date.now() - totalStartedAt
        })

        res.status(201).json({
            success: true,
            reportId,
            status: "processing",
            message: "Interview generation started.",
            interviewReport: publicReportSummary(interviewReport)
        })
        logGenerationStep("performance", "Total request completed", timingPayload(totalStartedAt, {
            reportId: interviewReport._id,
            statusCode: 201
        }))
    } catch (error) {
        logGenerationStep("performance", "Total request failed", timingPayload(totalStartedAt, {
            statusCode: error?.statusCode || error?.status || 500,
            errorMessage: error?.message || error?.reason || "Unknown error"
        }))
        return sendGenerationError(res, error?.step || "interview-generation", error, requestPayload)
    }

}

async function processInterviewReportJob({
    reportId,
    userId,
    user,
    resumeFile,
    styleResumeFile,
    normalizedSelfDescription,
    normalizedJobDescription,
    requestPayload,
    totalStartedAt
}) {
    const jobStartedAt = Date.now()
    const reportIdString = String(reportId)

    async function updateStage(stage, extra = {}) {
        logGenerationStep("background-job", `Stage ${stage}`, {
            reportId: reportIdString,
            userId,
            ...extra
        })
        await updateInterviewReportRecord(reportId, userId, {
            generationStage: stage,
            updatedAt: new Date()
        })
    }

    try {
        logGenerationStep("background-job", "Job started", {
            reportId: reportIdString,
            userId,
            jobDescriptionChars: normalizedJobDescription.length,
            selfDescriptionChars: normalizedSelfDescription.length,
            hasResume: Boolean(resumeFile),
            hasStyleResume: Boolean(styleResumeFile)
        })

        await updateStage("extracting-files")
        const [resumeText, styleResumeText] = await Promise.all([
            timedGenerationStage(
                "performance",
                "Resume extraction",
                () => extractTextFromFile(resumeFile),
                { reportId: reportIdString, hasResume: Boolean(resumeFile) }
            ),
            timedGenerationStage(
                "performance",
                "Style resume extraction",
                () => extractTextFromFile(styleResumeFile),
                { reportId: reportIdString, hasStyleResume: Boolean(styleResumeFile) }
            )
        ])

        logGenerationStep("request:files", "Resume text extracted", {
            reportId: reportIdString,
            resumeChars: resumeText.length,
            styleResumeChars: styleResumeText.length
        })

        await updateStage("analyzing-resume-style", {
            resumeChars: resumeText.length,
            styleResumeChars: styleResumeText.length
        })
        const resumeStyleProfile = analyzeResumeStyle({ sampleResumeText: styleResumeText })
        logGenerationStep("resume-style", "Resume style analysis completed", {
            reportId: reportIdString,
            hasStyleProfile: Boolean(resumeStyleProfile)
        })

        await updateStage("waiting-for-gemini")
        const interViewReportByAi = await timedGenerationStage("performance", "Interview report generation", () => generateInterviewReport({
            resume: resumeText,
            selfDescription: normalizedSelfDescription,
            jobDescription: normalizedJobDescription,
            user,
            onProgress: async (progress = {}) => {
                const retryAttempt = Number(progress.retryAttempt || 0)
                const maxRetries = Number(progress.maxRetries || 0)
                await updateStage(`retrying-gemini-attempt-${retryAttempt}-of-${maxRetries}`, {
                    retryAttempt,
                    maxRetries,
                    retryReason: progress.reason,
                    backoffMs: progress.delayMs,
                    geminiStage: progress.step,
                    model: progress.model,
                    quotaFailure: Boolean(progress.quotaFailure)
                })
            }
        }), {
            reportId: reportIdString,
            resumeChars: resumeText.length,
            selfDescriptionChars: normalizedSelfDescription.length,
            jobDescriptionChars: normalizedJobDescription.length
        })
        const generationWarnings = Array.isArray(interViewReportByAi.generationWarnings)
            ? interViewReportByAi.generationWarnings
            : []

        logPipelineSnapshot("background-job:after-report-generator", interViewReportByAi, {
            reportId: reportIdString,
            userId
        })
        assertCompleteGeneratedReport(interViewReportByAi, "before-save")

        logGenerationStep("service", "AI report generated", {
            reportId: reportIdString,
            title: interViewReportByAi.title,
            technicalQuestions: interViewReportByAi.technicalQuestions?.length || 0,
            behavioralQuestions: interViewReportByAi.behavioralQuestions?.length || 0,
            resumeQuestions: interViewReportByAi.resumeQuestions?.length || 0
        })

        await updateStage("finalizing-report")
        const completedAt = Date.now()
        const completionPayload = {
            resume: resumeText,
            styleResumeText,
            resumeStyleProfile,
            selfDescription: normalizedSelfDescription,
            jobDescription: normalizedJobDescription,
            questionState: {},
            dashboardState: {},
            ...interViewReportByAi,
            generationStatus: "completed",
            generationStage: "completed",
            generationError: {},
            generationCompletedAt: new Date(completedAt),
            generationDurationMs: completedAt - jobStartedAt,
            generationWarnings
        }
        logPipelineSnapshot("background-job:before-mongo-completion-update", completionPayload, {
            reportId: reportIdString,
            userId
        })
        const updatedReport = await timedGenerationStage("performance", "Mongo completion update", () => updateInterviewReportRecord(reportId, userId, completionPayload), {
            reportId: reportIdString,
            dbConnected: isDbConnected(),
            userId
        })
        logPipelineSnapshot("background-job:after-mongo-completion-update", updatedReport, {
            reportId: reportIdString,
            userId,
            dbConnected: isDbConnected()
        })

        if (!updatedReport) {
            throw new GenerationStepError({
                step: "database:completion-update",
                reason: "Could not update the generated interview report.",
                statusCode: 500,
                retryable: false,
                payload: { reportId: reportIdString, userId }
            })
        }

        const savedReport = await timedGenerationStage("performance", "Mongo completion verification", () => findInterviewReportRecord(reportId, userId), {
            reportId: reportIdString,
            dbConnected: isDbConnected(),
            userId
        })
        const savedReportValue = savedReport?.toObject ? savedReport.toObject() : savedReport
        logPipelineSnapshot("background-job:after-mongo-completion-fetch", savedReportValue, {
            reportId: reportIdString,
            userId,
            dbConnected: isDbConnected()
        })

        assertCompleteGeneratedReport(savedReportValue, "after-save")

        logGenerationStep("background-job", "Job completed", {
            reportId: reportIdString,
            status: savedReportValue?.generationStatus || "completed",
            totalRuntimeMs: Date.now() - totalStartedAt,
            backgroundRuntimeMs: Date.now() - jobStartedAt,
            warnings: generationWarnings.length
        })
    } catch (error) {
        const diagnostic = logGenerationFailure(error?.step || "background-job", error, {
            ...requestPayload,
            reportId: reportIdString
        })
        const failedAt = Date.now()
        const generationError = serializeJobError(error)

        await updateInterviewReportRecord(reportId, userId, {
            generationStatus: "failed",
            generationStage: generationError.step || "failed",
            generationError,
            generationFailedAt: new Date(failedAt),
            generationDurationMs: failedAt - jobStartedAt,
            generationWarnings: [],
            title: "Interview generation failed"
        })

        logGenerationStep("background-job", "Job failed and report updated", {
            reportId: reportIdString,
            userId,
            errorMessage: generationError.message,
            step: generationError.step,
            filename: diagnostic.filename,
            line: diagnostic.line,
            backgroundRuntimeMs: Date.now() - jobStartedAt
        })
    }
}

/**
 * @description Regenerate only the ATS Resume Builder section for an owned interview report.
 */
async function regenerateResumeBuilderController(req, res) {
    const { interviewId } = req.params

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(interviewId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    try {
        logGenerationStep("resume-builder:regenerate", "Resume Builder regeneration requested", {
            reportId: interviewId,
            userId: req.user?.id
        })

        const interviewReport = isDbConnected()
            ? await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
            : localStore.findInterviewReportById(interviewId, req.user.id)

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const resumeBuilder = await regenerateResumeBuilder({
            resume: interviewReport.resume || "",
            selfDescription: interviewReport.selfDescription || "",
            jobDescription: interviewReport.jobDescription || "",
            user: req.user,
            jobAnalysis: interviewReport.jobAnalysis || {},
            atsAnalysis: interviewReport.atsAnalysis || {}
        })
        const atsResumeData = normalizeAtsResumeData({
            resumeBuilder,
            atsAnalysis: interviewReport.atsAnalysis || {},
            resumeSuggestions: interviewReport.resumeSuggestions || []
        })

        const updatedReport = isDbConnected()
            ? await interviewReportModel.findOneAndUpdate(
                { _id: interviewId, user: req.user.id },
                { resumeBuilder, atsResumeData },
                { returnDocument: "after" }
            )
            : localStore.updateInterviewReport(interviewId, req.user.id, { resumeBuilder, atsResumeData })

        logGenerationStep("resume-builder:regenerate", "Resume Builder regeneration completed", {
            reportId: interviewId,
            hasResumeBuilder: Boolean(Object.keys(resumeBuilder || {}).length)
        })

        res.status(200).json({
            success: true,
            message: "Resume Builder regenerated successfully.",
            resumeBuilder: updatedReport.resumeBuilder,
            atsResumeData: updatedReport.atsResumeData,
            interviewReport: updatedReport
        })
    } catch (error) {
        return sendGenerationError(res, error?.step || "resume-builder:regenerate", error, { reportId: interviewId })
    }
}

/**
 * @description Controller to delete an owned interview report.
 */
async function deleteInterviewReportController(req, res) {
    const { interviewId } = req.params

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(interviewId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const deleted = isDbConnected()
        ? await interviewReportModel.findOneAndDelete({ _id: interviewId, user: req.user.id })
        : localStore.deleteInterviewReport(interviewId, req.user.id)

    if (!deleted) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report deleted successfully."
    })
}

/**
 * @description Controller to persist completion and bookmark state for a question.
 */
async function updateQuestionStateController(req, res) {
    const { interviewId } = req.params
    const { questionKey, completed, bookmarked } = req.body

    if (!questionKey || typeof questionKey !== "string") {
        return res.status(400).json({
            message: "Question key is required."
        })
    }

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(interviewId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const interviewReport = isDbConnected()
        ? await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
        : localStore.findInterviewReportById(interviewId, req.user.id)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const nextState = questionStateUpdate({
        currentState: interviewReport.questionState,
        questionKey,
        completed,
        bookmarked
    })

    const updatedReport = isDbConnected()
        ? await interviewReportModel.findOneAndUpdate(
            { _id: interviewId, user: req.user.id },
            { questionState: nextState },
            { returnDocument: "after" }
        )
        : localStore.updateInterviewReport(interviewId, req.user.id, { questionState: nextState })

    res.status(200).json({
        message: "Question state updated successfully.",
        questionState: normalizeQuestionState(updatedReport.questionState)
    })
}

/**
 * @description Controller to persist dashboard filter/search state.
 */
async function updateDashboardStateController(req, res) {
    const { interviewId } = req.params
    const dashboardState = {
        activeSection: req.body.activeSection || "technical",
        search: req.body.search || "",
        difficulty: req.body.difficulty || "all",
        status: req.body.status || "all",
        sort: req.body.sort || "default"
    }

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(interviewId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const updatedReport = isDbConnected()
        ? await interviewReportModel.findOneAndUpdate(
            { _id: interviewId, user: req.user.id },
            { dashboardState },
            { returnDocument: "after" }
        )
        : localStore.updateInterviewReport(interviewId, req.user.id, { dashboardState })

    if (!updatedReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Dashboard state updated successfully.",
        dashboardState: updatedReport.dashboardState
    })
}

/**
 * @description Controller to export an owned interview report as JSON or Markdown.
 */
async function exportInterviewReportController(req, res) {
    const { interviewId } = req.params
    const format = req.query.format === "markdown" ? "markdown" : "json"

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(interviewId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const interviewReport = isDbConnected()
        ? await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
        : localStore.findInterviewReportById(interviewId, req.user.id)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    if (format === "markdown") {
        res.set({
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename=interview_strategy_${interviewId}.md`
        })
        return res.send(reportToMarkdown(interviewReport))
    }

    res.set({
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=interview_strategy_${interviewId}.json`
    })

    res.send(JSON.stringify(interviewReport, null, 2))
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(interviewId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const interviewReport = isDbConnected()
        ? await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
        : localStore.findInterviewReportById(interviewId, req.user.id)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const reportValue = interviewReport.toObject ? interviewReport.toObject() : interviewReport
    logPipelineSnapshot("report-endpoint:after-mongo-fetch", reportValue, {
        reportId: String(interviewId),
        userId: req.user.id
    })

    if ((reportValue.generationStatus || "completed") === "completed") {
        try {
            assertCompleteGeneratedReport(reportValue, "report-read")
        } catch (error) {
            const generationError = serializeJobError(error)
            const failedReport = await updateInterviewReportRecord(interviewId, req.user.id, {
                generationStatus: "failed",
                generationStage: generationError.step,
                generationError,
                generationFailedAt: new Date()
            })

            return res.status(200).json({
                message: "Interview report fetched successfully.",
                interviewReport: failedReport || {
                    ...reportValue,
                    generationStatus: "failed",
                    generationStage: generationError.step,
                    generationError,
                    generationFailedAt: generationError.timestamp
                }
            })
        }
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}

/**
 * @description Controller to get async interview generation status by reportId.
 */
async function getInterviewReportStatusController(req, res) {
    const { reportId } = req.params

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(reportId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    let interviewReport = isDbConnected()
        ? await interviewReportModel
            .findOne({ _id: reportId, user: req.user.id })
            .select("_id generationStatus generationStage generationError generationStartedAt generationCompletedAt generationFailedAt generationDurationMs generationWarnings updatedAt")
        : localStore.findInterviewReportById(reportId, req.user.id)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const report = interviewReport.toObject ? interviewReport.toObject() : interviewReport
    let status = report.generationStatus || "completed"

    if (status === "completed") {
        try {
            interviewReport = await findInterviewReportRecord(reportId, req.user.id)
            const completeReport = interviewReport?.toObject ? interviewReport.toObject() : interviewReport
            logPipelineSnapshot("status-endpoint:completed-full-report-fetch", completeReport, {
                reportId: String(reportId),
                userId: req.user.id
            })
            assertCompleteGeneratedReport(completeReport, "status-read")
        } catch (error) {
            const generationError = serializeJobError(error)
            await updateInterviewReportRecord(reportId, req.user.id, {
                generationStatus: "failed",
                generationStage: generationError.step,
                generationError,
                generationFailedAt: new Date()
            })
            status = "failed"
            report.generationStatus = "failed"
            report.generationStage = generationError.step
            report.generationError = generationError
            report.generationFailedAt = generationError.timestamp
        }
    }

    const payload = {
        reportId: report._id,
        status,
        stage: report.generationStage || "",
        updatedAt: report.updatedAt
    }

    if (status === "completed") {
        payload.generationWarnings = report.generationWarnings || []
        payload.completedAt = report.generationCompletedAt
        payload.durationMs = report.generationDurationMs || 0
    }

    if (status === "failed") {
        payload.error = report.generationError?.reason || report.generationError?.message || "Interview generation failed."
        payload.details = report.generationError || {}
        payload.failedAt = report.generationFailedAt
        payload.durationMs = report.generationDurationMs || 0
    }

    res.status(200).json(payload)
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    let interviewReports = []

    if (isDbConnected()) {
        interviewReports = await interviewReportModel
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("_id title jobTitle company matchScore generationStatus generationStage generationError generationStartedAt generationCompletedAt generationFailedAt generationDurationMs createdAt updatedAt")
    } else {
        interviewReports = localStore.findInterviewReportsByUser(req.user.id).map((report) => ({
            _id: report._id,
            title: report.title,
            jobTitle: report.jobTitle,
            company: report.company,
            matchScore: report.matchScore,
            generationStatus: report.generationStatus || "completed",
            generationStage: report.generationStage || "",
            generationError: report.generationError || {},
            generationStartedAt: report.generationStartedAt,
            generationCompletedAt: report.generationCompletedAt,
            generationFailedAt: report.generationFailedAt,
            generationDurationMs: report.generationDurationMs || 0,
            createdAt: report.createdAt
        }))
    }

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    if (isDbConnected() && !mongoose.Types.ObjectId.isValid(interviewReportId)) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const interviewReport = isDbConnected()
        ? await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })
        : localStore.findInterviewReportById(interviewReportId, req.user.id)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription, styleResumeText, resumeStyleProfile, atsResumeData } = interviewReport

    const pdfBuffer = await generateResumePdf({
        resume,
        jobDescription,
        selfDescription,
        styleResumeText,
        resumeStyleProfile,
        atsResumeData,
        user: req.user
    })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

/**
 * @description Controller to answer career and job-preparation chat prompts with Gemini.
 */
async function careerChatController(req, res) {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : []
    const wantsStream = String(req.headers.accept || "").includes("text/event-stream")

    const hasUserMessage = messages.some(
        (message) => message?.role === "user" && String(message.content || "").trim()
    )

    if (!hasUserMessage) {
        return res.status(400).json({
            message: "At least one user message is required."
        })
    }

    if (wantsStream) {
        res.set({
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        })
        res.flushHeaders?.()
        writeSseEvent(res, "start", { ok: true })

        try {
            const reply = await streamCareerChatResponse({
                messages,
                user: req.user,
                onChunk: (chunk) => writeSseEvent(res, "chunk", { text: chunk })
            })

            writeSseEvent(res, "done", { reply })
            res.end()
        } catch (error) {
            const message = error?.reason || error?.message || "Gemini could not answer right now. Please try again."
            writeSseEvent(res, "error", { message })
            res.end()
        }
        return
    }

    const reply = await generateCareerChatResponse({
        messages,
        user: req.user
    })

    res.status(200).json({
        message: "AI response generated successfully.",
        reply
    })
}

function writeSseEvent(res, event, data) {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportStatusController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController,
    deleteInterviewReportController,
    updateQuestionStateController,
    updateDashboardStateController,
    exportInterviewReportController,
    careerChatController,
    regenerateResumeBuilderController
}
