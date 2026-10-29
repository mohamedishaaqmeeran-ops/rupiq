const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema({
  claimNumber: {
    type: String,
    required: true,
  },
  claimType: {
    type: String,
    enum: ["cashless", "reimbursement"],
    default: "cashless",
  },
  amountClaimed: {
    type: Number,
    required: true,
    min: 0,
  },
  amountApproved: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["submitted", "under_review", "surveyor_assigned", "approved", "settled", "rejected"],
    default: "submitted",
  },
  hospitalOrGarage: {
    type: String,
    trim: true,
    default: "",
  },
  incidentDate: {
    type: Date,
    default: Date.now,
  },
  settledDate: {
    type: Date,
  },
  remarks: {
    type: String,
    trim: true,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const insurancePolicySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    policyNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["health", "term_life", "motor", "travel", "cyber_device"],
      default: "health",
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    sumInsured: {
      type: Number,
      required: true,
      min: 0,
    },
    premiumAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    premiumFrequency: {
      type: String,
      enum: ["annual", "monthly"],
      default: "annual",
    },
    paymentMethod: {
      type: String,
      enum: ["bank_account", "upi"],
      default: "upi",
    },
    paymentReference: {
      type: String,
      required: true,
      trim: true,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: false,
    },
    upiId: {
      type: String,
      trim: true,
      default: "",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    nextRenewalDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "renewal_due", "expired", "claim_in_progress"],
      default: "active",
      index: true,
    },
    insuredPersons: [
      {
        name: { type: String, trim: true },
        relation: { type: String, trim: true },
        age: { type: Number },
      },
    ],
    nominee: {
      name: { type: String, trim: true, default: "Primary Nominee" },
      relation: { type: String, trim: true, default: "Spouse" },
    },
    cashlessNetworkCount: {
      type: Number,
      default: 10000,
    },
    taxBenefitSection: {
      type: String,
      default: "Section 80D",
    },
    policyDocumentId: {
      type: String,
      default: "",
    },
    claims: [claimSchema],
  },
  { timestamps: true }
);

insurancePolicySchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("InsurancePolicy", insurancePolicySchema);
