
const mongoose = require("mongoose");

const loanRepaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    principalPaid: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    interestPaid: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    prepaymentStrategy: {
      type: String,
      enum: ["reduce_tenure", "reduce_emi"],
      default: "reduce_tenure",
    },

    referenceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoanRepayment", loanRepaymentSchema);
