
const mongoose = require("mongoose");

const recurringTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    nextRunAt: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "paused", "cancelled"],
      default: "active",
      index: true,
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

recurringTransactionSchema.index({ user: 1, status: 1, nextRunAt: 1 });

module.exports = mongoose.model(
  "RecurringTransaction",
  recurringTransactionSchema
);
