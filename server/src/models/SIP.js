const mongoose = require("mongoose");

const sipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fundName: {
      type: String,
      required: true,
      trim: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Equity - Flexi Cap", "Equity - Small Cap", "Equity - Mid Cap", "Equity - Large Cap", "Index Fund", "Debt / Hybrid", "Thematic / Sectoral", "ETF / Stock SIP"],
      default: "Equity - Flexi Cap",
    },
    amount: {
      type: Number,
      required: true,
      min: [100, "Minimum SIP amount is ₹100"],
    },
    frequency: {
      type: String,
      enum: ["monthly", "weekly", "quarterly"],
      default: "monthly",
    },
    sipDate: {
      type: Number,
      required: true,
      min: 1,
      max: 28,
      default: 5,
    },
    status: {
      type: String,
      enum: ["active", "paused", "cancelled"],
      default: "active",
      index: true,
    },
    nextExecutionDate: {
      type: Date,
      required: true,
    },
    lastExecutedDate: {
      type: Date,
    },
    totalInstallments: {
      type: Number,
      default: 0,
    },
    totalInvested: {
      type: Number,
      default: 0,
    },
    unitsAllotted: {
      type: Number,
      default: 0,
    },
    currentNAV: {
      type: Number,
      default: 0,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    cagr3Y: {
      type: Number,
      default: 15.0,
    },
  },
  {
    timestamps: true,
  }
);

sipSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("SIP", sipSchema);
