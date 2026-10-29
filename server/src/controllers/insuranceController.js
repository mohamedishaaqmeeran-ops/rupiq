const InsurancePolicy = require("../models/InsurancePolicy");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

// ─── Preset Insurance Products Catalog ───────────────────────────────────────

const INSURANCE_CATALOG = [
  // 1. Health Insurance
  {
    id: "hdfc_optima_secure",
    category: "health",
    providerName: "HDFC ERGO",
    planName: "Optima Secure 4X Health Plan",
    badge: "Most Popular",
    rating: 4.8,
    claimSettlementRatio: "98.4%",
    cashlessNetworkCount: 13000,
    baseSumInsured: 1000000, // ₹10 Lakh
    sumInsuredOptions: [500000, 1000000, 2500000, 5000000, 10000000],
    baseAnnualPremium: 8450,
    features: [
      "4X Cover Benefit from Day 1",
      "Zero Copay at all Network Hospitals",
      "₹10,000 OPD & Dental Care Included",
      "Restore Benefit up to 100%",
    ],
    taxBenefitSection: "Section 80D - Save up to ₹25,000 tax",
    logoColor: "#004c8f",
  },
  {
    id: "star_comprehensive",
    category: "health",
    providerName: "Star Health",
    planName: "Star Comprehensive Health Shield",
    badge: "Zero Copay",
    rating: 4.7,
    claimSettlementRatio: "97.9%",
    cashlessNetworkCount: 14000,
    baseSumInsured: 1000000,
    sumInsuredOptions: [500000, 1000000, 2000000, 5000000],
    baseAnnualPremium: 7890,
    features: [
      "No Room Rent Capping",
      "Automatic Unlimited Restoration",
      "Pre & Post Hospitalization covered for 60/90 days",
      "Annual Health Checkup Free for all members",
    ],
    taxBenefitSection: "Section 80D - Save up to ₹25,000 tax",
    logoColor: "#0083ca",
  },
  {
    id: "care_supreme",
    category: "health",
    providerName: "Care Health",
    planName: "Care Supreme Super Shield",
    badge: "Unlimited Recharge",
    rating: 4.6,
    claimSettlementRatio: "96.8%",
    cashlessNetworkCount: 11500,
    baseSumInsured: 1500000,
    sumInsuredOptions: [700000, 1500000, 5000000, 10000000],
    baseAnnualPremium: 6990,
    features: [
      "Unlimited automatic recharge of sum insured",
      "500% Cumulative Bonus for claim-free years",
      "AYUSH Treatment fully covered",
      "Air Ambulance Cover up to ₹5 Lakh",
    ],
    taxBenefitSection: "Section 80D - Save up to ₹25,000 tax",
    logoColor: "#10b981",
  },

  // 2. Term Life Insurance
  {
    id: "icici_iprotect_smart",
    category: "term_life",
    providerName: "ICICI Prudential",
    planName: "iProtect Smart Term Protection",
    badge: "Top Claim Ratio",
    rating: 4.9,
    claimSettlementRatio: "99.2%",
    cashlessNetworkCount: 0,
    baseSumInsured: 10000000, // ₹1 Crore
    sumInsuredOptions: [5000000, 10000000, 15000000, 20000000],
    baseAnnualPremium: 8640,
    features: [
      "₹1 Crore Lump-sum Family Payout",
      "Terminal Illness 100% Payout in Advance",
      "Accidental Death Rider Available",
      "Waiver of Premium on Disability",
    ],
    taxBenefitSection: "Section 80C - Save up to ₹46,800 tax",
    logoColor: "#b32025",
  },
  {
    id: "hdfc_click_2_protect",
    category: "term_life",
    providerName: "HDFC Life",
    planName: "Click 2 Protect Super 3D",
    badge: "64 Critical Illnesses",
    rating: 4.8,
    claimSettlementRatio: "99.0%",
    cashlessNetworkCount: 0,
    baseSumInsured: 10000000,
    sumInsuredOptions: [7500000, 10000000, 20000000],
    baseAnnualPremium: 9800,
    features: [
      "Covers 64 Critical Illnesses with instant payout",
      "Return of Premium option upon maturity",
      "Increasing Life Cover as age progresses",
      "Smart Exit Benefit",
    ],
    taxBenefitSection: "Section 80C - Save up to ₹46,800 tax",
    logoColor: "#004c8f",
  },

  // 3. Motor & Vehicle Insurance
  {
    id: "digit_motor_protect",
    category: "motor",
    providerName: "Digit Insurance",
    planName: "Digit 360° Comprehensive Car & Bike",
    badge: "Zero Depreciation",
    rating: 4.8,
    claimSettlementRatio: "97.4%",
    cashlessNetworkCount: 6500,
    baseSumInsured: 450000,
    sumInsuredOptions: [250000, 450000, 850000, 1500000],
    baseAnnualPremium: 2850,
    features: [
      "Zero-Depreciation cover on metal, fiber & glass parts",
      "24x7 Roadside Assistance & Towing nationwide",
      "Engine & Gearbox Protection Add-on",
      "Key & Lock Replacement cover included",
    ],
    taxBenefitSection: "Business/Freelance Expense eligible",
    logoColor: "#f59e0b",
  },
  {
    id: "acko_drive_smart",
    category: "motor",
    providerName: "Acko General",
    planName: "Acko DriveSmart Zero-Dep",
    badge: "2-Hour Paperless Claim",
    rating: 4.7,
    claimSettlementRatio: "96.5%",
    cashlessNetworkCount: 5000,
    baseSumInsured: 350000,
    sumInsuredOptions: [150000, 350000, 750000],
    baseAnnualPremium: 1950,
    features: [
      "Instant self-inspection claim via mobile camera",
      "Doorstep pickup & 3-day repair guarantee",
      "Consumables Cover included",
      "No Claim Bonus (NCB) protection",
    ],
    taxBenefitSection: "GST Invoice available",
    logoColor: "#8b5cf6",
  },

  // 4. Travel & Cyber Security
  {
    id: "tata_travel_guard",
    category: "travel",
    providerName: "Tata AIG",
    planName: "Travel Guard Global Multi-Trip",
    badge: "Worldwide Medical",
    rating: 4.7,
    claimSettlementRatio: "98.1%",
    cashlessNetworkCount: 8000,
    baseSumInsured: 2500000, // $50,000 / ₹25L
    sumInsuredOptions: [1000000, 2500000, 5000000],
    baseAnnualPremium: 1250,
    features: [
      "Emergency Medical & Hospitalization abroad",
      "Flight Delay & Trip Cancellation compensation",
      "Lost Passport & Baggage Delay protection",
      "Adventure sports cover included",
    ],
    taxBenefitSection: "Travel Protection",
    logoColor: "#0284c7",
  },
  {
    id: "hdfc_cyber_shield",
    category: "cyber_device",
    providerName: "HDFC ERGO",
    planName: "CyberSafe UPI & Fraud Shield",
    badge: "UPI Fraud Protection",
    rating: 4.9,
    claimSettlementRatio: "98.9%",
    cashlessNetworkCount: 0,
    baseSumInsured: 500000, // ₹5 Lakh
    sumInsuredOptions: [100000, 500000, 1000000],
    baseAnnualPremium: 499,
    features: [
      "100% reimbursement for unauthorized UPI & Net Banking theft",
      "Phishing, SIM cloning & malware attack compensation",
      "Identity Theft & legal defense expenses covered",
      "Social media account restoration assistance",
    ],
    taxBenefitSection: "Cyber Security Asset",
    logoColor: "#004c8f",
  },
];

// GET /api/insurance/catalog
exports.getInsuranceCatalog = (req, res) => {
  res.status(200).json({
    success: true,
    count: INSURANCE_CATALOG.length,
    catalog: INSURANCE_CATALOG,
  });
};

// POST /api/insurance/calculate-quote (Realtime dynamic quote engine)
exports.calculateInstantQuote = (req, res) => {
  try {
    const {
      planId,
      category = "health",
      sumInsured,
      age = 28,
      membersCount = 1,
      isSmoker = false,
      addons = [], // e.g. ["critical_illness", "zero_dep", "personal_accident"]
    } = req.body;

    const product = INSURANCE_CATALOG.find((p) => p.id === planId) || INSURANCE_CATALOG[0];

    const targetSum = Number(sumInsured) || product.baseSumInsured;
    const ratio = targetSum / product.baseSumInsured;

    // Age multiplier
    let ageMultiplier = 1.0;
    if (age > 45) ageMultiplier = 1.6;
    else if (age > 35) ageMultiplier = 1.25;
    else if (age < 25) ageMultiplier = 0.9;

    // Family members factor
    const membersFactor = 1 + (Math.max(1, membersCount) - 1) * 0.45;

    // Smoker loading for term life
    const smokerFactor = isSmoker && category === "term_life" ? 1.5 : 1.0;

    // Addons cost
    let addonCost = 0;
    if (addons.includes("critical_illness")) addonCost += 1200;
    if (addons.includes("zero_dep")) addonCost += 750;
    if (addons.includes("personal_accident")) addonCost += 450;

    const calculatedAnnual = Math.round(
      (product.baseAnnualPremium * Math.pow(ratio, 0.75) * ageMultiplier * membersFactor * smokerFactor + addonCost)
    );

    const calculatedMonthly = Math.round(calculatedAnnual / 12 * 1.05);

    // Tax benefit estimation
    let estimatedTaxSaved = 0;
    if (category === "health") {
      estimatedTaxSaved = Math.min(Math.round(calculatedAnnual * 0.312), 7800); // 30% tax bracket
    } else if (category === "term_life") {
      estimatedTaxSaved = Math.min(Math.round(calculatedAnnual * 0.312), 46800);
    }

    res.status(200).json({
      success: true,
      quote: {
        planId: product.id,
        planName: product.planName,
        providerName: product.providerName,
        category: product.category,
        sumInsured: targetSum,
        annualPremium: calculatedAnnual,
        monthlyPremium: calculatedMonthly,
        estimatedTaxSaved,
        taxBenefitSection: product.taxBenefitSection,
        cashlessHospitals: product.cashlessNetworkCount,
        claimSettlementRatio: product.claimSettlementRatio,
        appliedFactors: {
          age,
          membersCount,
          isSmoker,
          addons,
        },
      },
    });
  } catch (error) {
    console.error("Quote calculation error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate quote." });
  }
};

// POST /api/insurance/buy-policy (Instant policy issuance via Bank Account OR UPI)
exports.buyInsurancePolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      planId,
      category = "health",
      providerName,
      planName,
      sumInsured,
      premiumAmount,
      premiumFrequency = "annual",
      paymentMethod = "upi", // "bank_account" | "upi"
      bankAccountId,
      upiId = "",
      insuredPersons = [],
      nominee = { name: "Primary Nominee", relation: "Spouse" },
    } = req.body;

    const numPremium = Number(premiumAmount);
    if (!planName || isNaN(numPremium) || numPremium <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy details or premium amount.",
      });
    }

    const isUpi = paymentMethod === "upi";
    let bankAccount = null;
    let effectiveUpiId = upiId.trim();

    // 1. Process payment via Bank Account or UPI
    if (!isUpi) {
      if (!bankAccountId) {
        return res.status(400).json({
          success: false,
          message: "Please choose a bank account to pay the premium.",
        });
      }

      bankAccount = await Account.findOne({ _id: bankAccountId, user: userId, isActive: true });
      if (!bankAccount) {
        return res.status(404).json({ success: false, message: "Bank account not found." });
      }

      if (bankAccount.balance < numPremium) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance in ${bankAccount.name}. Premium: ₹${numPremium.toLocaleString("en-IN")}, Available: ₹${bankAccount.balance.toLocaleString("en-IN")}`,
        });
      }

      // Deduct premium
      bankAccount.balance -= numPremium;
      await bankAccount.save();
    } else {
      // UPI payment
      if (bankAccountId) {
        bankAccount = await Account.findOne({ _id: bankAccountId, user: userId, isActive: true });
        if (bankAccount && bankAccount.balance >= numPremium) {
          bankAccount.balance -= numPremium;
          await bankAccount.save();
          if (!effectiveUpiId && bankAccount.upiId) {
            effectiveUpiId = bankAccount.upiId;
          }
        }
      }
      if (!effectiveUpiId) {
        effectiveUpiId = "user@okhdfcbank";
      }
    }

    // 2. Generate Realtime Policy Number & Payment Reference
    const catPrefix = category.slice(0, 3).toUpperCase();
    const policyNumber = `POL-${catPrefix}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const payRef = `${isUpi ? "UPI" : "PAY"}-INS-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(startDate.getFullYear() + (premiumFrequency === "annual" ? 1 : 0));
    if (premiumFrequency === "monthly") {
      expiryDate.setMonth(startDate.getMonth() + 1);
    }

    const nextRenewalDate = new Date(expiryDate);

    // 3. Log Expense Transaction in expense tracker
    await Transaction.create({
      user: userId,
      type: "expense",
      amount: numPremium,
      category: "Insurance & Protection",
      description: `Insurance Premium: ${providerName} - ${planName} (${policyNumber})`,
      date: new Date(),
      account: bankAccount?._id,
      notes: `Instant Policy Issue • Paid via ${isUpi ? `UPI (${effectiveUpiId})` : `Bank (${bankAccount?.name})`} • Ref: ${payRef}`,
    });

    // 4. Create Active Policy Record
    const policy = await InsurancePolicy.create({
      user: userId,
      policyNumber,
      category,
      providerName,
      planName,
      sumInsured: Number(sumInsured) || 1000000,
      premiumAmount: numPremium,
      premiumFrequency,
      paymentMethod: isUpi ? "upi" : "bank_account",
      paymentReference: payRef,
      account: bankAccount?._id,
      upiId: effectiveUpiId,
      startDate,
      expiryDate,
      nextRenewalDate,
      status: "active",
      insuredPersons: insuredPersons.length > 0 ? insuredPersons : [{ name: "Self", relation: "Self", age: 28 }],
      nominee,
      cashlessNetworkCount: category === "health" ? 12500 : 5000,
      taxBenefitSection: category === "term_life" ? "Section 80C" : "Section 80D",
      policyDocumentId: `DOC-${policyNumber}.pdf`,
    });

    res.status(201).json({
      success: true,
      message: `Congratulations! ${planName} policy issued in realtime. Policy No: ${policyNumber}`,
      policy,
      paymentReference: payRef,
      remainingBankBalance: bankAccount ? bankAccount.balance : undefined,
    });
  } catch (error) {
    console.error("Buy policy error:", error);
    res.status(500).json({ success: false, message: "Policy purchase failed." });
  }
};

// GET /api/insurance/my-policies (User's active insurance portfolio)
exports.getUserPolicies = async (req, res) => {
  try {
    const userId = req.user.id;
    const policies = await InsurancePolicy.find({ user: userId })
      .populate("account", "name institution color")
      .sort({ createdAt: -1 });

    const totalCoverAmount = policies.reduce((sum, p) => (p.status === "active" ? sum + p.sumInsured : sum), 0);
    const totalAnnualPremium = policies.reduce((sum, p) => (p.status === "active" ? sum + p.premiumAmount : sum), 0);
    const activeCount = policies.filter((p) => p.status === "active").length;

    // Tax deductions calculated
    const healthPolicies = policies.filter((p) => p.status === "active" && p.category === "health");
    const termPolicies = policies.filter((p) => p.status === "active" && p.category === "term_life");

    const taxSavings80D = Math.min(
      healthPolicies.reduce((sum, p) => sum + p.premiumAmount, 0),
      25000
    );
    const taxSavings80C = Math.min(
      termPolicies.reduce((sum, p) => sum + p.premiumAmount, 0),
      150000
    );

    res.status(200).json({
      success: true,
      count: policies.length,
      summary: {
        totalCoverAmount,
        totalAnnualPremium,
        activeCount,
        taxSavings80D,
        taxSavings80C,
      },
      policies,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load policies." });
  }
};

// POST /api/insurance/renew-policy (1-click policy renewal)
exports.renewPolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { policyId, paymentMethod = "upi", bankAccountId, upiId = "" } = req.body;

    const policy = await InsurancePolicy.findOne({ _id: policyId, user: userId });
    if (!policy) {
      return res.status(404).json({ success: false, message: "Policy not found." });
    }

    const isUpi = paymentMethod === "upi";
    let bankAccount = null;

    if (!isUpi && bankAccountId) {
      bankAccount = await Account.findOne({ _id: bankAccountId, user: userId, isActive: true });
      if (bankAccount) {
        if (bankAccount.balance < policy.premiumAmount) {
          return res.status(400).json({ success: false, message: "Insufficient bank balance for renewal." });
        }
        bankAccount.balance -= policy.premiumAmount;
        await bankAccount.save();
      }
    }

    // Extend 1 year
    const newExpiry = new Date(policy.expiryDate);
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    policy.expiryDate = newExpiry;
    policy.nextRenewalDate = newExpiry;
    policy.status = "active";
    await policy.save();

    // Log expense
    await Transaction.create({
      user: userId,
      type: "expense",
      amount: policy.premiumAmount,
      category: "Insurance & Protection",
      description: `Policy Renewal: ${policy.planName} (${policy.policyNumber})`,
      date: new Date(),
      account: bankAccount?._id,
      notes: `Renewed via ${isUpi ? `UPI (${upiId || "user@upi"})` : `Bank (${bankAccount?.name})`}`,
    });

    res.status(200).json({
      success: true,
      message: `Policy ${policy.policyNumber} successfully renewed until ${newExpiry.toLocaleDateString("en-IN")}.`,
      policy,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Policy renewal failed." });
  }
};

// POST /api/insurance/file-claim (Realtime Cashless / Reimbursement Claim)
exports.fileClaim = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      policyId,
      claimType = "cashless",
      amountClaimed,
      hospitalOrGarage = "",
      incidentDate = new Date(),
      remarks = "",
    } = req.body;

    const numAmount = Number(amountClaimed);
    if (!policyId || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid policy or claim amount." });
    }

    const policy = await InsurancePolicy.findOne({ _id: policyId, user: userId });
    if (!policy) {
      return res.status(404).json({ success: false, message: "Insurance policy not found." });
    }

    const claimNumber = `CLM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const newClaim = {
      claimNumber,
      claimType,
      amountClaimed: numAmount,
      amountApproved: 0,
      status: "submitted",
      hospitalOrGarage: hospitalOrGarage.trim(),
      incidentDate: new Date(incidentDate),
      remarks: remarks.trim() || `Realtime claim filed via PaisaPilot Insurance Hub`,
      createdAt: new Date(),
    };

    policy.claims.push(newClaim);
    policy.status = "claim_in_progress";
    await policy.save();

    res.status(201).json({
      success: true,
      message: `Claim ${claimNumber} submitted successfully. TPA cashless surveyor assigned.`,
      claimNumber,
      claim: newClaim,
      policy,
    });
  } catch (error) {
    console.error("File claim error:", error);
    res.status(500).json({ success: false, message: "Failed to file claim." });
  }
};

// GET /api/insurance/claims (Fetch all user claims across policies)
exports.getUserClaims = async (req, res) => {
  try {
    const userId = req.user.id;
    const policies = await InsurancePolicy.find({ user: userId, "claims.0": { $exists: true } });

    const allClaims = [];
    policies.forEach((pol) => {
      pol.claims.forEach((cl) => {
        allClaims.push({
          ...cl.toObject(),
          policyId: pol._id,
          policyNumber: pol.policyNumber,
          providerName: pol.providerName,
          planName: pol.planName,
          category: pol.category,
        });
      });
    });

    allClaims.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: allClaims.length,
      claims: allClaims,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load claims." });
  }
};

// POST /api/insurance/simulate-claim-step (Instant real-time claim status progression)
exports.simulateClaimStep = async (req, res) => {
  try {
    const userId = req.user.id;
    const { policyId, claimNumber, nextStatus, approvedAmount } = req.body;

    const policy = await InsurancePolicy.findOne({ _id: policyId, user: userId });
    if (!policy) {
      return res.status(404).json({ success: false, message: "Policy not found." });
    }

    const claim = policy.claims.find((c) => c.claimNumber === claimNumber);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found." });
    }

    const validStatuses = ["submitted", "under_review", "surveyor_assigned", "approved", "settled", "rejected"];
    if (nextStatus && validStatuses.includes(nextStatus)) {
      claim.status = nextStatus;
    } else {
      // Auto advance
      if (claim.status === "submitted") claim.status = "under_review";
      else if (claim.status === "under_review") claim.status = "surveyor_assigned";
      else if (claim.status === "surveyor_assigned") {
        claim.status = "approved";
        claim.amountApproved = approvedAmount || Math.round(claim.amountClaimed * 0.95);
      } else if (claim.status === "approved") {
        claim.status = "settled";
        claim.settledDate = new Date();
      }
    }

    if (claim.status === "settled" || claim.status === "rejected") {
      policy.status = "active";
    }

    await policy.save();

    res.status(200).json({
      success: true,
      message: `Claim ${claimNumber} status is now: ${claim.status.toUpperCase()}`,
      claim,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update claim." });
  }
};
