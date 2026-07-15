const dns = require("node:dns")
const mongoose = require("mongoose")
const { env, sanitizeMessage } = require("./env")

function configureDnsResolvers() {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"])
  } catch (error) {
    console.warn("Could not override DNS resolvers:", error.message)
  }
}

async function connectToDB() {
  try {
    const mongoUri = env.MONGO_URI

    if (!mongoUri) {
      throw new Error("MONGO_URI is not configured")
    }

    configureDnsResolvers()

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      family: 4
    })

    console.log("Connected to Database")
  } catch (err) {
    console.error("Database connection failed:", sanitizeMessage(err.message))
    throw err
  }
}

module.exports = connectToDB
