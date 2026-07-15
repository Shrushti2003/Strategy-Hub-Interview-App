const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    passwordChangedAt: {
      type: Date,
      default: null
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false
    },
    passwordResetRequestedAt: {
      type: Date,
      default: null,
      select: false
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model("User", userSchema)
