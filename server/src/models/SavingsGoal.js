
const mongoose = require("mongoose");

const savingsGoalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    targetAmount: {
      type: Number,
      required: true,
      min: [0.01, "Target amount must be greater than zero"],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: [0, "Saved amount cannot be negative"],
    },
    targetDate: {
      type: Date,
      default: null,
    },
    color: {
      type: String,
      default: "#10B981",
      match: /^#[0-9A-Fa-f]{6}$/,
    },
  },
  { timestamps: true }
);

savingsGoalSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("SavingsGoal", savingsGoalSchema);
