const mongoose = require("mongoose");

const goldHoldingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: ["GOLD_24K", "SILVER_999"],
      default: "GOLD_24K",
      required: true,
    },
    gramsHeld: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalInvested: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageBuyPricePerGram: {
      type: Number,
      default: 0,
      min: 0,
    },
    sipActive: {
      type: Boolean,
      default: false,
    },
    sipAmount: {
      type: Number,
      default: 0,
    },
    sipFrequency: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY"],
      default: "WEEKLY",
    },
  },
  { timestamps: true }
);

const goldOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: ["GOLD_24K", "SILVER_999"],
      default: "GOLD_24K",
    },
    orderType: {
      type: String,
      enum: ["BUY", "SELL", "SIP_AUTOBUY"],
      required: true,
    },
    grams: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    ratePerGram: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: "UPI",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      default: "SUCCESS",
    },
    vaultRef: {
      type: String,
      default: () => "VAULT-" + Math.floor(10000000 + Math.random() * 90000000),
    },
  },
  { timestamps: true }
);

const DigitalGoldHolding = mongoose.model("DigitalGoldHolding", goldHoldingSchema);
const DigitalGoldOrder = mongoose.model("DigitalGoldOrder", goldOrderSchema);

module.exports = { DigitalGoldHolding, DigitalGoldOrder };
