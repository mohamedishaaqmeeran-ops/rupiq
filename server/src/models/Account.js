const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: ["bank", "credit_card", "wallet", "investment", "cash"],
      default: "bank",
      required: true,
    },
    institution: {
      type: String,
      trim: true,
      default: "",
    },
    accountNumber: {
      type: String,
      trim: true,
      default: "",
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    upiId: {
      type: String,
      trim: true,
      default: "",
    },
    accountHolderName: {
      type: String,
      trim: true,
      default: "",
    },
    isRealtimeLinked: {
      type: Boolean,
      default: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    syncStatus: {
      type: String,
      enum: ["linked", "syncing", "error"],
      default: "linked",
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "AED", "GBP", "EUR"],
    },
    color: {
      type: String,
      default: "#3B82F6",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Account", accountSchema);
