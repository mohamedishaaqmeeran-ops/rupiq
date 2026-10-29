const InsurancePolicy = require("../models/InsurancePolicy");
const Loan = require("../models/Loan");
const SIP = require("../models/SIP");
const Transaction = require("../models/Transaction");

function calculateOldRegime(taxableIncome) {
  let tax = 0;
  if (taxableIncome <= 250000) {
    tax = 0;
  } else if (taxableIncome <= 500000) {
    tax = (taxableIncome - 250000) * 0.05;
  } else if (taxableIncome <= 1000000) {
    tax = 12500 + (taxableIncome - 500000) * 0.20;
  } else {
    tax = 12500 + 100000 + (taxableIncome - 1000000) * 0.30;
  }

  // Section 87A Rebate for Old Regime (if taxable income <= 5,00,000, max rebate 12,500)
  if (taxableIncome <= 500000) {
    tax = 0;
  }

  const cess = tax * 0.04;
  return {
    baseTax: Math.round(tax),
    cess: Math.round(cess),
    totalTax: Math.round(tax + cess),
  };
}

function calculateNewRegime(taxableIncome) {
  let tax = 0;
  if (taxableIncome <= 300000) {
    tax = 0;
  } else if (taxableIncome <= 700000) {
    tax = (taxableIncome - 300000) * 0.05;
  } else if (taxableIncome <= 1000000) {
    tax = 20000 + (taxableIncome - 700000) * 0.10;
  } else if (taxableIncome <= 1200000) {
    tax = 50000 + (taxableIncome - 1000000) * 0.15;
  } else if (taxableIncome <= 1500000) {
    tax = 80000 + (taxableIncome - 1200000) * 0.20;
  } else {
    tax = 140000 + (taxableIncome - 1500000) * 0.30;
  }

  // Section 87A Rebate for New Regime (taxable income <= 7,00,000, tax is 0)
  if (taxableIncome <= 700000) {
    tax = 0;
  }

  const cess = tax * 0.04;
  return {
    baseTax: Math.round(tax),
    cess: Math.round(cess),
    totalTax: Math.round(tax + cess),
  };
}

exports.getTaxProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // Detect actual deductions from user portfolio
    const [policies, loans, sips] = await Promise.all([
      InsurancePolicy.find({ user: userId, status: "Active" }),
      Loan.find({ user: userId }),
      SIP.find({ user: userId, status: "ACTIVE" }),
    ]);

    // Section 80D: Health Insurance premiums
    let healthInsurancePaid = 0;
    let lifeInsurancePaid = 0;
    policies.forEach((p) => {
      if (p.policyType === "HEALTH" || p.policyType === "CRITICAL_ILLNESS") {
        healthInsurancePaid += p.annualPremium || (p.monthlyPremium ? p.monthlyPremium * 12 : 0);
      } else {
        lifeInsurancePaid += p.annualPremium || (p.monthlyPremium ? p.monthlyPremium * 12 : 0);
      }
    });

    // Section 80C: Annual SIPs + Life Insurance (capped at 1.5 Lakhs)
    let annualSipInvestment = 0;
    sips.forEach((s) => {
      annualSipInvestment += (s.amount || 0) * 12;
    });

    const detected80C = Math.min(150000, Math.round(annualSipInvestment * 0.5 + lifeInsurancePaid));
    const detected80D = Math.min(75000, Math.round(healthInsurancePaid));

    // Section 24b: Home loan interest estimate
    let homeLoanInterest = 0;
    loans.forEach((l) => {
      if (l.type === "Home" || l.type === "Mortgage") {
        // approx interest: balance * rate / 100
        const annualInt = (l.remainingBalance || l.principalAmount || 0) * ((l.interestRate || 8.5) / 100);
        homeLoanInterest += Math.min(200000, annualInt);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        detected80C,
        detected80D,
        detectedHomeLoanInterest: Math.round(homeLoanInterest),
        breakdown: {
          policiesCount: policies.length,
          sipsCount: sips.length,
          activeLoansCount: loans.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.calculateTax = async (req, res) => {
  try {
    const {
      grossAnnualSalary = 1200000,
      otherIncome = 0,
      section80C = 150000,
      section80D = 25000,
      section80CCD = 50000, // NPS
      homeLoanInterest = 0, // Section 24b
      hraExemption = 0,
      ltaExemption = 0,
      otherDeductions = 0,
    } = req.body;

    const totalGross = Number(grossAnnualSalary) + Number(otherIncome);

    // Old Regime calculation
    const standardDeductionOld = 50000;
    const capped80C = Math.min(150000, Math.max(0, Number(section80C)));
    const capped80D = Math.min(100000, Math.max(0, Number(section80D)));
    const cappedNPS = Math.min(50000, Math.max(0, Number(section80CCD)));
    const cappedHomeLoan = Math.min(200000, Math.max(0, Number(homeLoanInterest)));
    const exemptions = Math.max(0, Number(hraExemption)) + Math.max(0, Number(ltaExemption));

    const totalOldDeductions =
      standardDeductionOld +
      capped80C +
      capped80D +
      cappedNPS +
      cappedHomeLoan +
      exemptions +
      Math.max(0, Number(otherDeductions));

    const taxableIncomeOld = Math.max(0, totalGross - totalOldDeductions);
    const oldTax = calculateOldRegime(taxableIncomeOld);

    // New Regime calculation (FY 2024-25 / FY 2025-26 rules: Standard deduction ₹75,000)
    const standardDeductionNew = 75000;
    const taxableIncomeNew = Math.max(0, totalGross - standardDeductionNew);
    const newTax = calculateNewRegime(taxableIncomeNew);

    const difference = oldTax.totalTax - newTax.totalTax;
    const recommendedRegime = difference > 0 ? "New Regime" : "Old Regime";
    const potentialSavings = Math.abs(difference);

    // Dynamic advice & tips
    const recommendations = [];
    if (capped80C < 150000) {
      recommendations.push({
        title: "Maximize Section 80C",
        desc: `You can invest ₹${(150000 - capped80C).toLocaleString("en-IN")} more in ELSS mutual funds or PPF to save up to ₹${Math.round((150000 - capped80C) * 0.312).toLocaleString("en-IN")} in Old Regime.`,
      });
    }
    if (capped80D < 25000) {
      recommendations.push({
        title: "Health Insurance under 80D",
        desc: "Buying a comprehensive health cover can reduce your taxable income by up to ₹25,000 (plus ₹50,000 for parents).",
      });
    }
    if (cappedNPS < 50000) {
      recommendations.push({
        title: "NPS Additional ₹50,000 under 80CCD(1B)",
        desc: "Invest in National Pension Scheme for exclusive tax deduction over and above Section 80C.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalGross,
        oldRegime: {
          standardDeduction: standardDeductionOld,
          totalDeductions: totalOldDeductions,
          taxableIncome: taxableIncomeOld,
          baseTax: oldTax.baseTax,
          cess: oldTax.cess,
          totalTax: oldTax.totalTax,
        },
        newRegime: {
          standardDeduction: standardDeductionNew,
          totalDeductions: standardDeductionNew,
          taxableIncome: taxableIncomeNew,
          baseTax: newTax.baseTax,
          cess: newTax.cess,
          totalTax: newTax.totalTax,
        },
        recommendedRegime,
        potentialSavings,
        recommendations,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
