const mongoose = require("mongoose");

const billPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: false,
    },
    paymentMethod: {
      type: String,
      enum: ["bank_account", "upi"],
      default: "bank_account",
    },
    upiId: {
      type: String,
      trim: true,
      default: "",
    },
    npciApprovalCode: {
      type: String,
      trim: true,
      default: "",
    },
    billerName: {
      type: String,
      required: true,
      trim: true,
    },
    billerCategory: {
      type: String,
      required: true,
      enum: [
        "electricity",
        "mobile_recharge",
        "postpaid",
        "dth",
        "broadband",
        "credit_card",
        "subscription",
        "gas_water",
        "insurance",
      ],
      default: "subscription",
    },
    consumerNumber: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least ₹1"],
    },
    status: {
      type: String,
      enum: ["success", "pending", "failed"],
      default: "success",
    },
    referenceId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

billPaymentSchema.index({ user: 1, paymentDate: -1 });

module.exports = mongoose.model("BillPayment", billPaymentSchema);
