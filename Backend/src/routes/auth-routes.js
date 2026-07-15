const { Router } = require("express")
const authController = require("../controllers/auth-controller")
const { authUser } = require("../middlewares/auth-middleware")

const authRouter = Router()

/**
 *  @route POST /api/auth/register
 *  @description Register a new user
 *  @access Public
 */
authRouter.post("/register", authController.registerUserController)

/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authController.loginUserController)
authRouter.post("/forgot-password", authController.requestPasswordResetController)
authRouter.get("/reset-password/verify", authController.verifyPasswordResetTokenController)
authRouter.post("/reset-password", authController.resetPasswordController)
authRouter.get("/get-me", authController.getMeController)
authRouter.post("/logout", authController.logoutUserController)
authRouter.get("/logout", authController.logoutUserController)
authRouter.patch("/account", authUser, authController.updateAccountController)
authRouter.patch("/password", authUser, authController.changePasswordController)
authRouter.delete("/account", authUser, authController.deleteAccountController)

module.exports = authRouter
