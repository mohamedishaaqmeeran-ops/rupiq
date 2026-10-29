const mongoose = require("mongoose");

/**
 * KYC (Know Your Customer) — SEBI & RBI Compliant
 *
 * Required by SEBI for investment accounts:
 *  - PAN card (mandatory for investments > ₹50,000/year)
 *  - Aadhaar (for e-KYC / video KYC)
 *  - Bank account (for settlement)
 *  - Risk profiling (AMFI requirement)
 *  - FATCA declaration (Foreign Account Tax Compliance Act)
 *  - Nominee details
 *
 * Regulatory references:
 *  - SEBI circular SEBI/HO/MIRSD/DOP/P/CIR/2021/570
 *  - RBI Master Direction on KYC 2016 (updated 2023)
 *  - Prevention of Money Laundering Act (PMLA) 2002
 */
const kycSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // ─── Status ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "submitted", "under_review", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, default: "" },
    approvedAt:      { type: Date },
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ─── Personal Details ─────────────────────────────────────────────────────
    fullName:       { type: String, trim: true, maxlength: 150 },
    dateOfBirth:    { type: Date },
    gender:         { type: String, enum: ["male", "female", "other", "prefer_not_to_say"] },
    fatherName:     { type: String, trim: true, maxlength: 150 },
    motherName:     { type: String, trim: true, maxlength: 150 },
    maritalStatus:  { type: String, enum: ["single", "married", "divorced", "widowed"] },
    nationality:    { type: String, default: "Indian", maxlength: 50 },
    countryOfBirth: { type: String, default: "India", maxlength: 50 },

    // ─── Contact ──────────────────────────────────────────────────────────────
    phone:    { type: String, maxlength: 15 },
    address: {
      line1:    { type: String, maxlength: 200 },
      line2:    { type: String, maxlength: 200 },
      city:     { type: String, maxlength: 100 },
      state:    { type: String, maxlength: 100 },
      pincode:  { type: String, maxlength: 10 },
      country:  { type: String, default: "India", maxlength: 100 },
    },

    // ─── PAN Card (mandatory — Income Tax Act, 1961) ──────────────────────────
    pan: {
      number:       { type: String, uppercase: true, trim: true, maxlength: 10 },
      name:         { type: String, trim: true, maxlength: 150 },   // Name on PAN
      dateOfBirth:  { type: Date },
      documentUrl:  { type: String },   // S3/Cloudinary URL (encrypted)
      verified:     { type: Boolean, default: false },
    },

    // ─── Aadhaar (UIDAI — e-KYC per RBI circular) ────────────────────────────
    aadhaar: {
      maskedNumber: { type: String, maxlength: 12 },   // Store only last 4 digits: "XXXX XXXX 4567"
      nameOnCard:   { type: String, trim: true, maxlength: 150 },
      documentUrl:  { type: String },
      verified:     { type: Boolean, default: false },
    },

    // ─── Bank Account (SEBI settlement account) ────────────────────────────────
    bankAccount: {
      accountNumber:      { type: String, maxlength: 20 },
      ifscCode:           { type: String, uppercase: true, trim: true, maxlength: 11 },
      bankName:           { type: String, maxlength: 100 },
      branchName:         { type: String, maxlength: 100 },
      accountType:        { type: String, enum: ["savings", "current", "nre", "nro"] },
      accountHolderName:  { type: String, maxlength: 150 },
      cancelledChequeUrl: { type: String },
      verified:           { type: Boolean, default: false },
    },

    // ─── Occupation & Income (AMFI / SEBI risk profiling) ─────────────────────
    occupation: {
      type: String,
      enum: [
        "salaried_private",
        "salaried_government",
        "self_employed",
        "business_owner",
        "professional",   // CA, Doctor, Lawyer etc.
        "student",
        "retired",
        "homemaker",
        "agriculturalist",
        "other",
      ],
    },
    annualIncome: {
      type: String,
      enum: [
        "below_1L",
        "1L_5L",
        "5L_10L",
        "10L_25L",
        "25L_1Cr",
        "above_1Cr",
      ],
    },
    sourceOfFunds: {
      type: String,
      enum: [
        "salary",
        "business_income",
        "rental_income",
        "investments",
        "inheritance",
        "gift",
        "other",
      ],
    },

    // ─── Risk Profile (AMFI requirement for MF investments) ───────────────────
    riskProfile: {
      score:       { type: Number, min: 0, max: 100 },
      category:    { type: String, enum: ["conservative", "moderate", "aggressive", "very_aggressive"] },
      assessedAt:  { type: Date },
      answers:     { type: mongoose.Schema.Types.Mixed },  // Q&A JSON
    },

    // ─── FATCA Declaration (mandatory — PMLA 2002 + OECD CRS) ─────────────────
    fatca: {
      isUSPerson:              { type: Boolean },
      taxResidencyCountry:     { type: String, default: "India", maxlength: 100 },
      taxIdentificationNumber: { type: String, maxlength: 50 },   // TIN for non-residents
      declarationAccepted:     { type: Boolean, default: false },
      declarationDate:         { type: Date },
      isPoliticallyExposed:    { type: Boolean, default: false },  // PEP check
    },

    // ─── Nominee (SEBI circular 2021 — mandatory for demat) ───────────────────
    nominee: {
      name:         { type: String, trim: true, maxlength: 150 },
      relationship: {
        type: String,
        enum: ["spouse", "child", "parent", "sibling", "other"],
      },
      dateOfBirth:  { type: Date },
      percentage:   { type: Number, min: 0, max: 100, default: 100 },
      guardianName: { type: String, maxlength: 150 },   // Required if nominee is minor
    },

    // ─── Consents & Declarations ───────────────────────────────────────────────
    consents: {
      termsAccepted:          { type: Boolean, default: false },
      termsAcceptedAt:        { type: Date },
      privacyAccepted:        { type: Boolean, default: false },
      pmlaDeclaration:        { type: Boolean, default: false },   // Anti-money laundering
      electronicConsentGiven: { type: Boolean, default: false },   // e-sign / DigiLocker
    },

    // ─── Demat Account (NSDL/CDSL — for equity trading) ──────────────────────
    dematAccount: {
      dpId:          { type: String, maxlength: 8 },
      beneficiaryId: { type: String, maxlength: 8 },
      depository:    { type: String, enum: ["NSDL", "CDSL"] },
      linked:        { type: Boolean, default: false },
    },

    // ─── Submission metadata ──────────────────────────────────────────────────
    submittedAt:       { type: Date },
    ipAddress:         { type: String },
    userAgent:         { type: String },
    completionPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for admin queries
kycSchema.index({ status: 1, createdAt: -1 });
kycSchema.index({ "pan.number": 1 }, { sparse: true });

module.exports = mongoose.model("KYC", kycSchema);
