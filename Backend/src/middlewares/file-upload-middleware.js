const multer = require("multer")

const allowedMimeTypes = new Set([
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
])

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter(req, file, callback) {
        if (allowedMimeTypes.has(file.mimetype)) {
            return callback(null, true)
        }

        return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname))
    }
})


module.exports = upload
