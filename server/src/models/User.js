const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin", "super_admin"],
      default: "user",
      immutable: true,
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "AED", "GBP", "EUR"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("User", userSchema);