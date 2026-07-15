const { Router } = require("express")
const { authUser } = require("../middlewares/auth-middleware")
const resumeExportController = require("../controllers/resume-export-controller")

const resumeExportRouter = Router()

resumeExportRouter.post("/pdf", authUser, resumeExportController.exportResumePdfController)

module.exports = resumeExportRouter
