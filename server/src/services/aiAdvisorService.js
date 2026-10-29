const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Loan = require("../models/Loan");
const SavingsGoal = require("../models/SavingsGoal");
const VirtualPortfolio = require("../models/VirtualPortfolio");
const InvestmentTransaction = require("../models/InvestmentTransaction");

// Helper to gather a holistic financial snapshot for a user
async function getUserFinancialContext(userId) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Transactions for current month
  const transactions = await Transaction.find({
    user: userId,
    date: { $gte: startOfMonth },
  }).lean();

  let income = 0;
  let expenses = 0;
  const categorySpending = {};

  for (const t of transactions) {
    if (t.type === "income") {
      income += t.amount;
    } else {
      expenses += t.amount;
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    }
  }

  // 2. Active Budgets
  const budgets = await Budget.find({
    user: userId,
    month: currentMonthStr,
  }).lean();

  const budgetAnalysis = budgets.map((b) => {
    const spent = categorySpending[b.category] || 0;
    return {
      category: b.category,
      limit: b.amount,
      spent,
      isExceeded: spent > b.amount,
      percentUsed: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
    };
  });

  // 3. Loans & EMI
  const loans = await Loan.find({
    user: userId,
    status: "active",
  }).lean();

  const totalOutstandingLoan = loans.reduce((sum, l) => sum + (l.outstandingAmount || l.principalAmount), 0);
  const totalMonthlyEMI = loans.reduce((sum, l) => sum + (l.emiAmount || 0), 0);

  // 4. Savings Goals
  const goals = await SavingsGoal.find({ user: userId }).lean();
  const goalsSummary = goals.map((g) => ({
    name: g.name,
    target: g.targetAmount,
    current: g.currentAmount,
    percentComplete: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
  }));

  // 5. Portfolio & Cash
  const portfolio = await VirtualPortfolio.findOne({ user: userId }).lean();
  const availableCash = portfolio ? portfolio.availableCash : 0;

  const holdings = await InvestmentTransaction.aggregate([
    { $match: { user: userId, portfolioMode: "virtual" } },
    {
      $group: {
        _id: "$symbol",
        assetType: { $first: "$assetType" },
        units: {
          $sum: {
            $cond: [{ $eq: ["$transactionType", "buy"] }, "$quantity", { $multiply: ["$quantity", -1] }],
          },
        },
        totalCost: {
          $sum: {
            $cond: [{ $eq: ["$transactionType", "buy"] }, { $multiply: ["$quantity", "$pricePerUnit"] }, 0],
          },
        },
      },
    },
    { $match: { units: { $gt: 0 } } },
  ]);

  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  const dtiRatio = income > 0 ? Math.round((totalMonthlyEMI / income) * 100) : 0;

  return {
    income,
    expenses,
    netSavings: income - expenses,
    savingsRate,
    dtiRatio,
    categorySpending,
    budgetAnalysis,
    loans: loans.map((l) => ({
      lender: l.lenderName,
      type: l.loanType,
      outstanding: l.outstandingAmount || l.principalAmount,
      interestRate: l.interestRate,
      emi: l.emiAmount,
    })),
    totalOutstandingLoan,
    totalMonthlyEMI,
    goals: goalsSummary,
    availableTradingCash: availableCash,
    holdings: holdings.map((h) => ({
      symbol: h._id,
      assetType: h.assetType,
      units: h.units,
    })),
  };
}

// Smart heuristic engine when Gemini key is not set or network is offline
function generateLocalAdvisoryResponse(userQuery, ctx) {
  const query = (userQuery || "").toLowerCase();

  const formattedIncome = `₹${ctx.income.toLocaleString("en-IN")}`;
  const formattedExpenses = `₹${ctx.expenses.toLocaleString("en-IN")}`;
  const formattedSavings = `₹${ctx.netSavings.toLocaleString("en-IN")}`;
  const formattedEMI = `₹${ctx.totalMonthlyEMI.toLocaleString("en-IN")}`;
  const formattedDebt = `₹${ctx.totalOutstandingLoan.toLocaleString("en-IN")}`;
  const formattedCash = `₹${ctx.availableTradingCash.toLocaleString("en-IN")}`;

  // Topic 1: Loan & Debt Payoff
  if (query.includes("loan") || query.includes("emi") || query.includes("debt")) {
    if (ctx.loans.length === 0) {
      return (
        "Great news! You currently have **no active loans or EMIs recorded**. " +
        "You're in a strong financial position to accelerate your investments or emergency savings!"
      );
    }

    const highestRateLoan = [...ctx.loans].sort((a, b) => b.interestRate - a.interestRate)[0];

    return (
      `### 🛡️ Debt Payoff Strategy\n\n` +
      `You currently have **${ctx.loans.length} active loan(s)** with a total outstanding balance of **${formattedDebt}** ` +
      `and a monthly commitment of **${formattedEMI}** (${ctx.dtiRatio}% of your monthly income).\n\n` +
      `**Recommended Next Steps:**\n` +
      `1. **Debt Avalanche Method**: Target your highest interest loan first (**${highestRateLoan.lender}** at **${highestRateLoan.interestRate}% interest**). Paying an extra ₹2,000–₹5,000/month here saves the most on interest.\n` +
      `2. **DTI Health**: Your Debt-to-Income ratio is **${ctx.dtiRatio}%**. A healthy ratio is below 35%. You are ${ctx.dtiRatio <= 35 ? "within safe limits" : "slightly high, focus on prepayments"}.\n` +
      `3. **Autopay Verification**: Ensure your bank account has sufficient balance 2 days prior to the EMI auto-debit to protect your CIBIL score.`
    );
  }

  // Topic 2: Investment & Wealth Allocation
  if (query.includes("invest") || query.includes("trade") || query.includes("stock") || query.includes("crypto") || query.includes("allocate")) {
    return (
      `### 📈 Wealth Growth & Asset Allocation\n\n` +
      `You have **${formattedCash}** in available trading cash and **${ctx.holdings.length}** open positions in your portfolio.\n\n` +
      `**Prudent Allocation Model:**\n` +
      `* **50% Core Equities / Index (₹${Math.round(ctx.availableTradingCash * 0.5).toLocaleString("en-IN")})**: Bluechips like Reliance & TCS or Nifty 50 Index for long-term compound wealth.\n` +
      `* **20% Digital Gold & SGB (₹${Math.round(ctx.availableTradingCash * 0.2).toLocaleString("en-IN")})**: Sovereign Gold Bonds provide 2.5% annual sovereign interest + gold appreciation.\n` +
      `* **20% Fixed Income / Bonds (₹${Math.round(ctx.availableTradingCash * 0.2).toLocaleString("en-IN")})**: Govt of India bonds for steady capital preservation.\n` +
      `* **10% High-Growth / Crypto (₹${Math.round(ctx.availableTradingCash * 0.1).toLocaleString("en-IN")})**: Bitcoin or high-cap crypto for asymmetric upside with strict risk management.`
    );
  }

  // Topic 3: Spending / Budget / Saving
  if (query.includes("save") || query.includes("spend") || query.includes("budget") || query.includes("cut") || query.includes("afford")) {
    const topCategories = Object.entries(ctx.categorySpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amt]) => `* **${cat}**: ₹${amt.toLocaleString("en-IN")}`)
      .join("\n");

    return (
      `### 💰 Savings & Budget Diagnostic\n\n` +
      `This month, your total income is **${formattedIncome}**, total expenses are **${formattedExpenses}**, giving you a net savings of **${formattedSavings}** (${ctx.savingsRate}% savings rate).\n\n` +
      `**Your Top 3 Spending Categories:**\n` +
      `${topCategories || "* No expense data recorded yet."}\n\n` +
      `**Advisor Recommendations:**\n` +
      `1. **Rule of 50/30/20**: Aim for 50% on Needs (Rent, Utilities, EMI), 30% on Wants (Dining, Shopping), and 20% to Savings/Investing. Your current savings rate is **${ctx.savingsRate}%**.\n` +
      `2. **Discretionary Trimming**: Look at dining out and subscription bundles—capping these can free up ₹3,000–₹5,000 extra each month directly into your savings goals!`
    );
  }

  // General / Default Diagnostic
  return (
    `### 🧭 PaisaPilot Financial Overview\n\n` +
    `Here is a summary of your current financial standing:\n\n` +
    `* **Monthly Cashflow**: ${formattedIncome} in / ${formattedExpenses} out (**+${formattedSavings}** net)\n` +
    `* **Savings Rate**: **${ctx.savingsRate}%** (Benchmark: 20%+)\n` +
    `* **Debt-to-Income (DTI)**: **${ctx.dtiRatio}%** across ${ctx.loans.length} loan(s)\n` +
    `* **Trading Cash Ready**: **${formattedCash}**\n\n` +
    `You can ask me anything specific, such as:\n` +
    `* *"How can I pay off my loans faster?"*\n` +
    `* *"Where can I cut expenses to save ₹10,000 more?"*\n` +
    `* *"How should I allocate my cash in the trading hub?"*`
  );
}

// Call Gemini API if GEMINI_API_KEY is configured
async function callGemini(userPrompt, ctx, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return generateLocalAdvisoryResponse(userPrompt, ctx);
  }

  const systemInstruction =
    `You are PaisaPilot AI, an elite, certified financial advisor and wealth coach. ` +
    `You provide personalized, empowering, actionable advice using Indian Rupees (₹) and Indian market context (NSE, BSE, SGB, Mutual Funds, CIBIL). ` +
    `Always be respectful, concise, structured with bullet points and bold highlights.\n\n` +
    `User Financial Snapshot:\n` +
    `- Income (this month): ₹${ctx.income}\n` +
    `- Expenses: ₹${ctx.expenses}\n` +
    `- Net Savings: ₹${ctx.netSavings} (Savings Rate: ${ctx.savingsRate}%)\n` +
    `- Debt Commitments: Total Outstanding: ₹${ctx.totalOutstandingLoan}, Monthly EMI: ₹${ctx.totalMonthlyEMI} (DTI: ${ctx.dtiRatio}%)\n` +
    `- Active Loans: ${JSON.stringify(ctx.loans)}\n` +
    `- Category Spending: ${JSON.stringify(ctx.categorySpending)}\n` +
    `- Goals: ${JSON.stringify(ctx.goals)}\n` +
    `- Investment Available Cash: ₹${ctx.availableTradingCash}\n` +
    `- Portfolio Holdings: ${JSON.stringify(ctx.holdings)}\n\n` +
    `Answer the user's inquiry directly using their real financial data.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const contents = [
      {
        role: "user",
        parts: [{ text: `${systemInstruction}\n\nUser Question: ${userPrompt}` }],
      },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    }
  } catch (err) {
    console.warn("Gemini API call failed, using local advisor engine:", err.message);
  }

  return generateLocalAdvisoryResponse(userPrompt, ctx);
}

// Generate Full Financial Health Audit
async function generateFullAudit(userId) {
  const ctx = await getUserFinancialContext(userId);

  const emergencyFundTarget = ctx.expenses * 6;
  const emergencyFundCurrent = ctx.goals.find((g) => g.name.toLowerCase().includes("emergency"))?.current || 0;
  const emergencyCoverageMonths = ctx.expenses > 0 ? (emergencyFundCurrent / ctx.expenses).toFixed(1) : 0;

  let healthScore = 70;
  if (ctx.savingsRate >= 20) healthScore += 10;
  else if (ctx.savingsRate < 5) healthScore -= 15;

  if (ctx.dtiRatio <= 30) healthScore += 10;
  else if (ctx.dtiRatio > 45) healthScore -= 20;

  if (emergencyCoverageMonths >= 3) healthScore += 10;

  healthScore = Math.max(10, Math.min(100, healthScore));

  return {
    healthScore,
    status: healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : "Needs Attention",
    metrics: {
      monthlyIncome: ctx.income,
      monthlyExpenses: ctx.expenses,
      netSavings: ctx.netSavings,
      savingsRate: ctx.savingsRate,
      dtiRatio: ctx.dtiRatio,
      totalDebt: ctx.totalOutstandingLoan,
      monthlyEMI: ctx.totalMonthlyEMI,
      tradingCash: ctx.availableTradingCash,
      emergencyFundMonths: Number(emergencyCoverageMonths),
    },
    recommendations: [
      ctx.savingsRate < 20
        ? "Aim to raise your monthly savings rate to at least 20% by auditing discretionary dining & subscriptions."
        : "Your 20%+ savings rate is healthy! Continue compounding into diversified equity & gold.",
      ctx.totalOutstandingLoan > 0
        ? `Deploy surplus savings into prepaying your highest interest loan to drop your ${ctx.dtiRatio}% DTI ratio.`
        : "You are debt-free! Maximize your tax-advantaged investments and index SIPs.",
      emergencyCoverageMonths < 6
        ? `Build your emergency fund to 6 months of expenses (Target: ₹${Math.round(emergencyFundTarget).toLocaleString("en-IN")}).`
        : "Your emergency fund buffer is fully fortified!",
    ],
  };
}

// ─── Saver to Investor (Savings-to-Wealth) Engine ───────────────────────────
const KYC = require("../models/KYC");
const SIP = require("../models/SIP");

async function generateSaverToInvestorPlan(userId) {
  const ctx = await getUserFinancialContext(userId);
  const kyc = await KYC.findOne({ user: userId }).lean();
  const existingSips = await SIP.find({ user: userId, status: "active" }).lean();
  const currentSipTotal = existingSips.reduce((sum, s) => sum + s.amount, 0);

  // Real or benchmarked cash flow
  const hasRecordedData = ctx.income > 0 || ctx.expenses > 0;
  const income = hasRecordedData ? ctx.income : 65000;
  const expenses = hasRecordedData ? ctx.expenses : 42000;
  const netSavings = Math.max(0, income - expenses);
  const savingsRate = income > 0 ? Math.round((netSavings / income) * 100) : 35;

  // Prudent financial guardrails:
  // Retain 35% of monthly savings as liquid emergency buffer; deploy 65% into wealth compounding
  const liquidBufferShare = 0.35;
  const recommendedInvestable = Math.max(1000, Math.round(netSavings * (1 - liquidBufferShare)));
  const liquidEmergencyRetained = Math.max(0, netSavings - recommendedInvestable);

  // KYC Risk Profile check
  const riskCategory = (kyc?.riskProfile?.category || "Moderate").toLowerCase();

  // Tailored Allocation Matrix
  let allocationRules = [];
  if (riskCategory.includes("aggressive")) {
    allocationRules = [
      {
        symbol: "NIPPON_SMALLCAP",
        name: "Nippon India Small Cap Fund",
        assetType: "mutual_fund",
        sharePercent: 35,
        expectedCagr: 28.9,
        rationale: "High-conviction small cap for rapid long-term alpha generation.",
      },
      {
        symbol: "NIFTYBEES",
        name: "Nippon India ETF Nifty BeES",
        assetType: "etf",
        sharePercent: 35,
        expectedCagr: 14.2,
        rationale: "India's top 50 bluechips index foundation.",
      },
      {
        symbol: "PPFAS_FLEXI",
        name: "Parag Parikh Flexi Cap Fund",
        assetType: "mutual_fund",
        sharePercent: 20,
        expectedCagr: 21.8,
        rationale: "Disciplined value investing with international tech exposure.",
      },
      {
        symbol: "GOLDBEES",
        name: "Nippon India ETF Gold BeES",
        assetType: "etf",
        sharePercent: 10,
        expectedCagr: 12.0,
        rationale: "Inflation hedge and portfolio stabilizer.",
      },
    ];
  } else if (riskCategory.includes("conservative")) {
    allocationRules = [
      {
        symbol: "SBI_EQUITY_HYBRID",
        name: "SBI Equity Hybrid Fund",
        assetType: "mutual_fund",
        sharePercent: 40,
        expectedCagr: 14.5,
        rationale: "Defensive mix of equity growth and steady debt income.",
      },
      {
        symbol: "GOI_7.18_2033",
        name: "Govt of India 7.18% GS 2033 (Bond)",
        assetType: "bond",
        sharePercent: 30,
        expectedCagr: 7.2,
        rationale: "Sovereign guaranteed zero-default capital preservation.",
      },
      {
        symbol: "NIFTYBEES",
        name: "Nippon India ETF Nifty BeES",
        assetType: "etf",
        sharePercent: 20,
        expectedCagr: 14.2,
        rationale: "Core large-cap index participation.",
      },
      {
        symbol: "GOLDBEES",
        name: "Nippon India ETF Gold BeES",
        assetType: "etf",
        sharePercent: 10,
        expectedCagr: 12.0,
        rationale: "Safe-haven gold buffer.",
      },
    ];
  } else {
    // Moderate (Default)
    allocationRules = [
      {
        symbol: "NIFTYBEES",
        name: "Nippon India ETF Nifty BeES",
        assetType: "etf",
        sharePercent: 40,
        expectedCagr: 14.2,
        rationale: "Benchmark Nifty 50 compounder with ultra-low expense ratio.",
      },
      {
        symbol: "PPFAS_FLEXI",
        name: "Parag Parikh Flexi Cap Fund",
        assetType: "mutual_fund",
        sharePercent: 35,
        expectedCagr: 21.8,
        rationale: "Consistent 5-star wealth compounding across market cycles.",
      },
      {
        symbol: "GOLDBEES",
        name: "Nippon India ETF Gold BeES",
        assetType: "etf",
        sharePercent: 15,
        expectedCagr: 12.0,
        rationale: "Strategic asset class diversification against rupee depreciation.",
      },
      {
        symbol: "GOI_7.18_2033",
        name: "Govt of India Bond 7.18%",
        assetType: "bond",
        sharePercent: 10,
        expectedCagr: 7.2,
        rationale: "Stable sovereign income cushion.",
      },
    ];
  }

  // Calculate exact monthly rupee amounts for each allocation
  const recommendations = allocationRules.map((rule) => {
    const monthlyAmt = Math.round((recommendedInvestable * rule.sharePercent) / 100);
    return {
      ...rule,
      monthlyAmount: Math.max(500, Math.round(monthlyAmt / 100) * 100),
    };
  });

  // Calculate Weighted Average Expected Return (CAGR)
  const weightedCagr =
    recommendations.reduce((sum, r) => sum + r.expectedCagr * (r.sharePercent / 100), 0) / 100;

  // Compounding Future Corpus function
  const calcCorpus = (monthlyP, annualR, years) => {
    const r = annualR / 12;
    const n = years * 12;
    if (r === 0) return monthlyP * n;
    return Math.round(monthlyP * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
  };

  const projections = [1, 3, 5, 10].map((years) => {
    const invested = recommendedInvestable * years * 12;
    const aiWealth = calcCorpus(recommendedInvestable, weightedCagr, years);
    const bankIdle = calcCorpus(recommendedInvestable, 0.035, years); // 3.5% savings bank rate
    const wealthGain = aiWealth - bankIdle;

    return {
      years,
      totalInvested: invested,
      aiProjectedCorpus: aiWealth,
      idleBankCorpus: bankIdle,
      extraWealthGenerated: wealthGain,
    };
  });

  return {
    success: true,
    cashflow: {
      monthlyIncome: income,
      monthlyExpenses: expenses,
      netSavings,
      savingsRate,
      hasRecordedData,
    },
    saverToInvestor: {
      riskProfile: kyc?.riskProfile?.category || "Moderate",
      isKycApproved: kyc?.status === "approved",
      recommendedInvestableMonthly: recommendedInvestable,
      liquidEmergencyRetained,
      currentActiveSipsTotal: currentSipTotal,
      unallocatedSurplus: Math.max(0, recommendedInvestable - currentSipTotal),
      weightedAnnualReturnPct: Math.round(weightedCagr * 1000) / 10,
      recommendations,
      projections,
    },
  };
}

// Auto-execute or allocate savings into recommended SIPs
async function executeSaverPlan(userId, payload = {}) {
  const plan = await generateSaverToInvestorPlan(userId);
  const recommendations = plan.saverToInvestor.recommendations;

  const results = [];
  for (const item of recommendations) {
    if (item.assetType === "mutual_fund" || item.assetType === "etf") {
      const existing = await SIP.findOne({
        user: userId,
        symbol: item.symbol,
        status: "active",
      });

      if (!existing) {
        const created = await SIP.create({
          user: userId,
          fundName: item.name,
          symbol: item.symbol,
          category: item.assetType === "etf" ? "ETF / Stock SIP" : "Equity - Flexi Cap",
          amount: item.monthlyAmount,
          sipDate: 5,
          nextExecutionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          lastExecutedDate: new Date(),
          totalInstallments: 1,
          totalInvested: item.monthlyAmount,
          unitsAllotted: Math.round((item.monthlyAmount / 150) * 100) / 100,
          currentNAV: 150,
          currentValue: item.monthlyAmount,
          cagr3Y: item.expectedCagr,
          status: "active",
        });
        results.push(created);
      }
    }
  }

  return {
    success: true,
    message: `Allocated ₹${plan.saverToInvestor.recommendedInvestableMonthly.toLocaleString("en-IN")}/month into ${results.length} active wealth-generating SIPs!`,
    createdSips: results,
  };
}

module.exports = {
  getUserFinancialContext,
  callGemini,
  generateFullAudit,
  generateSaverToInvestorPlan,
  executeSaverPlan,
};
