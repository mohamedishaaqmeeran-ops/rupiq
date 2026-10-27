
const mongoose = require("mongoose");

const investmentTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    portfolioMode: {
      type: String,
      enum: ["virtual"],
      default: "virtual",
      required: true,
    },

    assetType: {
      type: String,
      enum: [
        "stock",
        "mutual_fund",
        "etf",
        "bond",
        "gold",
        "crypto",
      ],
      required: true,
    },

    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    assetName: {
      type: String,
      required: true,
      trim: true,
    },

    transactionType: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.00000001,
    },

    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },

    fees: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },

    transactionDate: {
      type: Date,
      default: Date.now,
      required: true,
      validate: {
        validator: (date) => date <= new Date(),
        message: "Transaction date cannot be in the future.",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

investmentTransactionSchema.index({
  user: 1,
  transactionDate: -1,
});

module.exports = mongoose.model(
  "InvestmentTransaction",
  investmentTransactionSchema
);
