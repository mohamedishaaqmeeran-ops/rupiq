
const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    lenderName: {
      type: String,
      required: true,
      trim: true,
    },

    loanType: {
      type: String,
      enum: [
        "personal",
        "home",
        "vehicle",
        "education",
        "business",
        "credit-card",
        "other",
      ],
      default: "personal",
      required: true,
    },

    principalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    interestRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

   
    tenureMonths: {
      type: Number,
      required: true,
      min: 1,
    },

    remainingTenureMonths: {
      type: Number,
      min: 0,
      default: null,
    },


    startDate: {
      type: Date,
      required: true,
    },

    emiAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    outstandingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    
    accruedInterest: {
      type: Number,
      min: 0,
      default: 0,
    },

    nextDueDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Loan", loanSchema);
