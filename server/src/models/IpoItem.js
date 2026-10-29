const mongoose = require("mongoose");

const ipoItemSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Mainboard", "SME"],
      default: "Mainboard",
    },
    status: {
      type: String,
      enum: ["OPEN", "UPCOMING", "CLOSED", "LISTED"],
      default: "OPEN",
    },
    issuePrice: {
      type: Number,
      required: true,
    },
    lotSize: {
      type: Number,
      default: 30,
    },
    minInvestment: {
      type: Number,
      required: true,
    },
    gmp: {
      type: Number,
      default: 0,
    },
    gmpPercent: {
      type: Number,
      default: 0,
    },
    subscriptionOverall: {
      type: Number,
      default: 1.0,
    },
    openDate: {
      type: String,
      default: "28 Oct 2026",
    },
    closeDate: {
      type: String,
      default: "31 Oct 2026",
    },
    listingDate: {
      type: String,
      default: "05 Nov 2026",
    },
    rating: {
      type: String,
      default: "SUBSCRIBE FOR LISTING GAINS",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IpoItem", ipoItemSchema);
