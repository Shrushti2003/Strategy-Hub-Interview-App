const { env, sanitizeMessage } = require("./src/config/env")
const app = require("./src/app")
const connectToDB = require("./src/config/database")

async function startServer() {
    const port = env.PORT

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`)
    })

    try {
      await connectToDB()
    } catch (error) {
      if (env.NODE_ENV !== "production") {
        console.warn(`Starting server without MongoDB. Local fallback storage will be used. ${sanitizeMessage(error.message)}`)
      } else {
        throw error
      }
    }
}

startServer().catch(() => {
    process.exit(1)
})
