const mongoose = require("mongoose");

const creditCardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cardName: {
      type: String,
      required: true,
      trim: true,
    },
    issuer: {
      type: String,
      required: true,
      trim: true,
    },
    lastFour: {
      type: String,
      default: "4821",
    },
    network: {
      type: String,
      enum: ["Visa", "Mastercard", "RuPay", "Amex"],
      default: "Visa",
    },
    creditLimit: {
      type: Number,
      required: true,
      min: 1000,
    },
    currentSpend: {
      type: Number,
      default: 0,
      min: 0,
    },
    billingDay: {
      type: Number,
      default: 15,
      min: 1,
      max: 31,
    },
    dueDay: {
      type: Number,
      default: 5,
      min: 1,
      max: 31,
    },
    color: {
      type: String,
      default: "#1E293B",
    },
    accentColor: {
      type: String,
      default: "#F5D084",
    },
    rewardType: {
      type: String,
      default: "Cashback",
    },
    perks: [String],
    categoryMultipliers: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditCard", creditCardSchema);
