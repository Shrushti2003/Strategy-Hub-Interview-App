const express = require("express")
const authMiddleware = require("../middlewares/auth-middleware")
const interviewController = require("../controllers/interview-controller")
const upload = require("../middlewares/file-upload-middleware")

const interviewRouter = express.Router()



/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description,resume pdf and job description.
 * @access private
 */
interviewRouter.post(
    "/",
    authMiddleware.authUser,
    upload.fields([
        { name: "resume", maxCount: 1 },
        { name: "styleResume", maxCount: 1 }
    ]),
    interviewController.generateInterViewReportController
)

/**
 * @route GET /api/interview/:reportId/status
 * @description get async interview generation status.
 * @access private
 */
interviewRouter.get("/:reportId/status", authMiddleware.authUser, interviewController.getInterviewReportStatusController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId.
 * @access private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportByIdController)

/**
 * @route POST /api/interview/chat
 * @description answer career and job-preparation chat prompts with Gemini.
 * @access private
 */
interviewRouter.post("/chat", authMiddleware.authUser, interviewController.careerChatController)

/**
 * @route POST /api/interview/:interviewId/resume-builder
 * @description regenerate only the ATS Resume Builder section for an owned report.
 * @access private
 */
interviewRouter.post("/:interviewId/resume-builder", authMiddleware.authUser, interviewController.regenerateResumeBuilderController)

/**
 * @route DELETE /api/interview/:interviewId
 * @description delete an owned interview report.
 * @access private
 */
interviewRouter.delete("/:interviewId", authMiddleware.authUser, interviewController.deleteInterviewReportController)

/**
 * @route PUT /api/interview/:interviewId/question-state
 * @description update bookmark and completion state for one generated question.
 * @access private
 */
interviewRouter.put("/:interviewId/question-state", authMiddleware.authUser, interviewController.updateQuestionStateController)

/**
 * @route PUT /api/interview/:interviewId/dashboard-state
 * @description persist dashboard filters and active section.
 * @access private
 */
interviewRouter.put("/:interviewId/dashboard-state", authMiddleware.authUser, interviewController.updateDashboardStateController)

/**
 * @route GET /api/interview/export/:interviewId
 * @description export an owned interview report as json or markdown.
 * @access private
 */
interviewRouter.get("/export/:interviewId", authMiddleware.authUser, interviewController.exportInterviewReportController)


/**
 * @route GET /api/interview/
 * @description get all interview reports of logged in user.
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)


/**
 * @route GET /api/interview/resume/pdf
 * @description generate resume pdf on the basis of user self description, resume content and job description.
 * @access private
 */
interviewRouter.post("/resume/pdf/:interviewReportId", authMiddleware.authUser, interviewController.generateResumePdfController)



module.exports = interviewRouter
