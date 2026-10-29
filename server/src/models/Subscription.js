const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
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
    },
    plan: {
      type: String,
      default: "Standard",
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "ANNUAL"],
      default: "MONTHLY",
    },
    category: {
      type: String,
      enum: ["Entertainment", "Music", "Fitness", "Cloud", "Utilities", "Productivity", "Other"],
      default: "Entertainment",
    },
    nextBillingDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "CANCELLED"],
      default: "ACTIVE",
    },
    icon: {
      type: String,
      default: "tv-outline",
    },
    color: {
      type: String,
      default: "#E50914",
    },
    remindDaysBefore: {
      type: Number,
      default: 3,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
