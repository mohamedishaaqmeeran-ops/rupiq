
const mongoose = require("mongoose");

const virtualPortfolioSchema = new mongoose.Schema(
  {
    user: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
  unique: true,
  index: true,
},

    startingCash: {
      type: Number,
      required: true,
      min: 0,
      default: 100000,
    },

    availableCash: {
      type: Number,
      required: true,
      min: 0,
      default: 100000,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "VirtualPortfolio",
  virtualPortfolioSchema
);
