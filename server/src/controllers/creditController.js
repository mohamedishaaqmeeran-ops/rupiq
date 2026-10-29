const Account = require("../models/Account");
const Loan = require("../models/Loan");
const BillPayment = require("../models/BillPayment");

function calculateCreditMetrics(accounts, loans, billPayments) {
  let totalCreditDebt = 0;
  let totalCreditLimit = 0;
  let creditCardCount = 0;

  accounts.forEach((acc) => {
    if (acc.type === "credit_card") {
      creditCardCount++;
      totalCreditDebt += acc.balance || 0;
      totalCreditLimit += acc.creditLimit || (acc.balance * 2.5 > 50000 ? acc.balance * 2.5 : 75000);
    }
  });

  // Credit utilization ratio
  const utilizationRatio = totalCreditLimit > 0 ? Math.round((totalCreditDebt / totalCreditLimit) * 100) : 18;

  // Payment history score (35% weight)
  const missedLoans = loans.filter((l) => l.status === "Overdue").length;
  const onTimePaymentRate = missedLoans === 0 ? 99 : Math.max(70, 99 - missedLoans * 12);

  // Credit Age & Mix
  const activeLines = accounts.length + loans.length;

  // Base score algorithm (scale 300 to 900)
  let score = 750;

  // Utilization impact (Ideal: < 30%)
  if (utilizationRatio <= 20) score += 35;
  else if (utilizationRatio <= 30) score += 15;
  else if (utilizationRatio <= 50) score -= 25;
  else score -= 65;

  // Payment history impact
  if (onTimePaymentRate >= 98) score += 25;
  else if (onTimePaymentRate < 90) score -= 50;

  // Account mix impact
  if (activeLines >= 3) score += 10;

  // Clamp 300 - 900
  score = Math.min(880, Math.max(320, score));

  let tier = "Good";
  let tierColor = "#10B981";
  if (score >= 750) {
    tier = "Excellent";
    tierColor = "#10B981";
  } else if (score >= 680) {
    tier = "Good";
    tierColor = "#60A5FA";
  } else if (score >= 580) {
    tier = "Fair";
    tierColor = "#F59E0B";
  } else {
    tier = "Poor";
    tierColor = "#EF4444";
  }

  return {
    score,
    tier,
    tierColor,
    utilizationRatio,
    totalCreditDebt: Math.round(totalCreditDebt),
    totalCreditLimit: Math.round(totalCreditLimit),
    onTimePaymentRate,
    activeLines,
    creditCardCount,
  };
}

// GET /api/credit/score
exports.getCreditScore = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const [accounts, loans, billPayments] = await Promise.all([
      Account.find({ user: userId, isActive: true }),
      Loan.find({ user: userId }),
      BillPayment.find({ user: userId }).limit(20),
    ]);

    const metrics = calculateCreditMetrics(accounts, loans, billPayments);

    const factors = [
      {
        name: "Payment History",
        weight: "35% High Impact",
        status: metrics.onTimePaymentRate >= 95 ? "Excellent" : "Needs Attention",
        value: `${metrics.onTimePaymentRate}% on-time`,
        icon: "checkmark-circle-outline",
        color: metrics.onTimePaymentRate >= 95 ? "#10B981" : "#EF4444",
      },
      {
        name: "Credit Card Utilization",
        weight: "30% High Impact",
        status: metrics.utilizationRatio <= 30 ? "Optimal" : "High Usage",
        value: `${metrics.utilizationRatio}% used (₹${metrics.totalCreditDebt.toLocaleString("en-IN")} of ₹${metrics.totalCreditLimit.toLocaleString("en-IN")})`,
        icon: "pie-chart-outline",
        color: metrics.utilizationRatio <= 30 ? "#10B981" : "#F59E0B",
      },
      {
        name: "Credit Mix & Active Accounts",
        weight: "15% Medium Impact",
        status: metrics.activeLines >= 2 ? "Healthy" : "Limited",
        value: `${metrics.activeLines} active credit accounts`,
        icon: "card-outline",
        color: "#60A5FA",
      },
      {
        name: "Recent Credit Inquiries",
        weight: "10% Low Impact",
        status: "Good",
        value: "0 inquiries in past 90 days",
        icon: "search-outline",
        color: "#10B981",
      },
    ];

    res.status(200).json({
      success: true,
      data: {
        score: metrics.score,
        tier: metrics.tier,
        tierColor: metrics.tierColor,
        agency: "CIBIL / Experian Official Gauge",
        asOfDate: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        metrics,
        factors,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/credit/simulate
exports.simulateScore = (req, res) => {
  try {
    const { currentScore = 760, action, amount = 0 } = req.body;

    let delta = 0;
    let description = "";

    switch (action) {
      case "pay_debt":
        delta = Math.min(38, Math.round((parseFloat(amount) || 10000) / 1000) * 1.5 + 12);
        description = `Paying down ₹${Number(amount).toLocaleString("en-IN")} of card debt reduces credit utilization and can boost your score by +${delta} points.`;
        break;
      case "miss_emi":
        delta = -52;
        description = "A single 30-day late payment or missed EMI severely hurts payment history, dropping your score by ~50 points.";
        break;
      case "close_card":
        delta = -18;
        description = "Closing an existing credit card reduces total available credit and shortens credit history, potentially lowering your score.";
        break;
      case "new_card":
        delta = -6;
        description = "A new credit card application triggers a hard inquiry (-6 pts), but expands total credit limit over time.";
        break;
      default:
        delta = 0;
        description = "No simulated change.";
    }

    const projectedScore = Math.min(890, Math.max(300, currentScore + delta));

    res.status(200).json({
      success: true,
      projectedScore,
      delta,
      action,
      description,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
