const SIP = require("../models/SIP");
const InvestmentTransaction = require("../models/InvestmentTransaction");
const VirtualPortfolio = require("../models/VirtualPortfolio");

// Top-rated Indian Mutual Funds Data (SEBI Registered AMCs)
const MUTUAL_FUNDS = [
  {
    symbol: "PPFAS_FLEXI",
    name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
    shortName: "Parag Parikh Flexi Cap",
    amc: "PPFAS Mutual Fund",
    category: "Equity - Flexi Cap",
    rating: 5,
    nav: 84.62,
    prevNav: 83.95,
    cagr1Y: 28.4,
    cagr3Y: 21.8,
    cagr5Y: 23.5,
    fundSizeCr: 72450,
    minSipAmount: 1000,
    minLumpsum: 1000,
    expenseRatio: 0.61,
    riskometer: "Very High",
    exitLoad: "2% if redeemed within 365 days; 1% if within 730 days",
    topHoldings: ["HDFC Bank", "ITC", "Bajaj Holdings", "Alphabet Inc", "Power Grid", "Coal India"],
  },
  {
    symbol: "HDFC_MIDCAP",
    name: "HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth",
    shortName: "HDFC Mid-Cap Opp.",
    amc: "HDFC Mutual Fund",
    category: "Equity - Mid Cap",
    rating: 5,
    nav: 194.25,
    prevNav: 192.80,
    cagr1Y: 34.2,
    cagr3Y: 26.5,
    cagr5Y: 24.1,
    fundSizeCr: 68300,
    minSipAmount: 500,
    minLumpsum: 500,
    expenseRatio: 0.74,
    riskometer: "Very High",
    exitLoad: "1% if redeemed within 1 year",
    topHoldings: ["Tata Communications", "Indian Hotels", "Balkrishna Ind", "Max Healthcare", "Coforge"],
  },
  {
    symbol: "NIPPON_SMALLCAP",
    name: "Nippon India Small Cap Fund - Direct Plan - Growth",
    shortName: "Nippon Small Cap",
    amc: "Nippon India Mutual Fund",
    category: "Equity - Small Cap",
    rating: 5,
    nav: 172.40,
    prevNav: 170.90,
    cagr1Y: 38.6,
    cagr3Y: 28.9,
    cagr5Y: 27.8,
    fundSizeCr: 54100,
    minSipAmount: 500,
    minLumpsum: 5000,
    expenseRatio: 0.67,
    riskometer: "Very High",
    exitLoad: "1% if redeemed within 1 month",
    topHoldings: ["HDFC Bank", "Tube Investments", "Apar Industries", "KPIT Tech", "Carborundum Univ"],
  },
  {
    symbol: "MIRAE_LARGECAP",
    name: "Mirae Asset Large Cap Fund - Direct Plan - Growth",
    shortName: "Mirae Large Cap",
    amc: "Mirae Asset Mutual Fund",
    category: "Equity - Large Cap",
    rating: 4,
    nav: 118.80,
    prevNav: 118.10,
    cagr1Y: 22.4,
    cagr3Y: 16.8,
    cagr5Y: 17.2,
    fundSizeCr: 39500,
    minSipAmount: 500,
    minLumpsum: 1000,
    expenseRatio: 0.54,
    riskometer: "Very High",
    exitLoad: "1% if redeemed within 365 days",
    topHoldings: ["Reliance Industries", "HDFC Bank", "ICICI Bank", "Infosys", "L&T", "TCS"],
  },
  {
    symbol: "QUANT_ACTIVE",
    name: "Quant Active Fund - Direct Plan - Growth",
    shortName: "Quant Active",
    amc: "Quant Mutual Fund",
    category: "Equity - Flexi Cap",
    rating: 4,
    nav: 692.15,
    prevNav: 688.40,
    cagr1Y: 32.1,
    cagr3Y: 23.4,
    cagr5Y: 26.1,
    fundSizeCr: 10800,
    minSipAmount: 1000,
    minLumpsum: 1000,
    expenseRatio: 0.77,
    riskometer: "Very High",
    exitLoad: "1% if redeemed within 15 days",
    topHoldings: ["Reliance Industries", "Jio Financial", "Aurobindo Pharma", "Bikaji Foods", "PNB"],
  },
  {
    symbol: "UTI_NIFTY50_INDEX",
    name: "UTI Nifty 50 Index Fund - Direct Plan - Growth",
    shortName: "UTI Nifty 50 Index",
    amc: "UTI Mutual Fund",
    category: "Index Fund",
    rating: 5,
    nav: 178.90,
    prevNav: 178.10,
    cagr1Y: 23.8,
    cagr3Y: 16.2,
    cagr5Y: 16.9,
    fundSizeCr: 18900,
    minSipAmount: 500,
    minLumpsum: 1000,
    expenseRatio: 0.18,
    riskometer: "Very High",
    exitLoad: "Nil",
    topHoldings: ["HDFC Bank", "Reliance", "ICICI Bank", "Infosys", "TCS", "ITC", "L&T"],
  },
  {
    symbol: "ICICI_TECH",
    name: "ICICI Prudential Technology Fund - Direct Plan - Growth",
    shortName: "ICICI Prudential Tech",
    amc: "ICICI Prudential Mutual Fund",
    category: "Thematic / Sectoral",
    rating: 4,
    nav: 224.50,
    prevNav: 222.10,
    cagr1Y: 27.5,
    cagr3Y: 19.8,
    cagr5Y: 25.4,
    fundSizeCr: 13400,
    minSipAmount: 500,
    minLumpsum: 5000,
    expenseRatio: 0.88,
    riskometer: "Very High",
    exitLoad: "1% if redeemed within 15 days",
    topHoldings: ["Infosys", "TCS", "Tech Mahindra", "Bharti Airtel", "Wipro", "HCL Tech"],
  },
  {
    symbol: "SBI_EQUITY_HYBRID",
    name: "SBI Equity Hybrid Fund - Direct Plan - Growth",
    shortName: "SBI Equity Hybrid",
    amc: "SBI Mutual Fund",
    category: "Debt / Hybrid",
    rating: 4,
    nav: 288.75,
    prevNav: 287.90,
    cagr1Y: 18.2,
    cagr3Y: 14.5,
    cagr5Y: 15.1,
    fundSizeCr: 71200,
    minSipAmount: 500,
    minLumpsum: 1000,
    expenseRatio: 0.72,
    riskometer: "High",
    exitLoad: "1% if redeemed within 365 days beyond 10% limit",
    topHoldings: ["HDFC Bank", "ICICI Bank", "Govt Bonds 7.18%", "State Bank of India", "Infosys"],
  },
];

// Calculate next SIP date from now
function getNextSipDate(sipDay) {
  const now = new Date();
  const currentDay = now.getDate();
  const target = new Date(now.getFullYear(), now.getMonth(), sipDay, 10, 0, 0);
  if (currentDay >= sipDay) {
    target.setMonth(target.getMonth() + 1);
  }
  return target;
}

// ─── GET /api/investments/mutual-funds ───────────────────────────────────────
exports.getMutualFunds = (req, res) => {
  res.json({
    success: true,
    count: MUTUAL_FUNDS.length,
    funds: MUTUAL_FUNDS,
  });
};

// ─── GET /api/investments/sip ────────────────────────────────────────────────
exports.getUserSips = async (req, res) => {
  try {
    const sips = await SIP.find({ user: req.user.id }).sort({ createdAt: -1 });

    // Update with current NAV and current value
    const updatedSips = sips.map(s => {
      const fund = MUTUAL_FUNDS.find(f => f.symbol === s.symbol);
      const currentNav = fund ? fund.nav : (s.currentNAV || 100);
      const currentValue = Math.round(s.unitsAllotted * currentNav * 100) / 100;
      return {
        ...s.toObject(),
        currentNAV: currentNav,
        currentValue: currentValue > 0 ? currentValue : s.totalInvested,
      };
    });

    res.json({ success: true, count: updatedSips.length, sips: updatedSips });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load SIPs" });
  }
};

// ─── POST /api/investments/sip ───────────────────────────────────────────────
exports.createSip = async (req, res) => {
  try {
    const { symbol, amount, sipDate = 5, executeFirstNow = true } = req.body;
    const numAmount = Number(amount);

    if (!symbol || !numAmount || numAmount < 100) {
      return res.status(400).json({
        success: false,
        message: "Please specify a valid mutual fund symbol and an amount of at least ₹100",
      });
    }

    const fund = MUTUAL_FUNDS.find(f => f.symbol === symbol.toUpperCase());
    const fundName = fund ? fund.name : symbol;
    const category = fund ? fund.category : "Equity - Flexi Cap";
    const currentNav = fund ? fund.nav : 100;
    const cagr = fund ? fund.cagr3Y : 15.0;

    const nextDate = getNextSipDate(Number(sipDate));

    let totalInvested = 0;
    let unitsAllotted = 0;
    let totalInstallments = 0;

    // Execute first installment into virtual portfolio if user opted-in
    if (executeFirstNow) {
      const units = Math.round((numAmount / currentNav) * 1000) / 1000;
      totalInvested = numAmount;
      unitsAllotted = units;
      totalInstallments = 1;

      // Deduct from virtual cash & record transaction
      const portfolio = await VirtualPortfolio.findOne({ user: req.user.id });
      if (portfolio && portfolio.availableCash >= numAmount) {
        portfolio.availableCash -= numAmount;
        await portfolio.save();
      }

      await InvestmentTransaction.create({
        user: req.user.id,
        assetType: "mutual_fund",
        symbol: symbol.toUpperCase(),
        assetName: fund ? fund.shortName : symbol,
        transactionType: "buy",
        quantity: units,
        pricePerUnit: currentNav,
        totalAmount: numAmount,
        fees: 0,
        transactionDate: new Date(),
        notes: `SIP installment #1 for ${fundName}`,
      });
    }

    const sip = await SIP.create({
      user: req.user.id,
      fundName,
      symbol: symbol.toUpperCase(),
      category,
      amount: numAmount,
      sipDate: Number(sipDate),
      nextExecutionDate: nextDate,
      lastExecutedDate: executeFirstNow ? new Date() : null,
      totalInstallments,
      totalInvested,
      unitsAllotted,
      currentNAV: currentNav,
      currentValue: Math.round(unitsAllotted * currentNav * 100) / 100,
      cagr3Y: cagr,
      status: "active",
    });

    res.status(201).json({
      success: true,
      message: executeFirstNow
        ? `SIP started successfully! First installment of ₹${numAmount.toLocaleString("en-IN")} processed.`
        : `SIP created successfully! Next deduction on ${nextDate.toDateString()}.`,
      sip,
    });
  } catch (err) {
    console.error("Create SIP error:", err);
    res.status(500).json({ success: false, message: "Failed to create SIP" });
  }
};

// ─── PATCH /api/investments/sip/:id ──────────────────────────────────────────
exports.updateSipStatus = async (req, res) => {
  try {
    const { status, amount, sipDate } = req.body;
    const sip = await SIP.findOne({ _id: req.params.id, user: req.user.id });

    if (!sip) {
      return res.status(404).json({ success: false, message: "SIP not found" });
    }

    if (status && ["active", "paused", "cancelled"].includes(status)) {
      sip.status = status;
    }
    if (amount && Number(amount) >= 100) {
      sip.amount = Number(amount);
    }
    if (sipDate && Number(sipDate) >= 1 && Number(sipDate) <= 28) {
      sip.sipDate = Number(sipDate);
      sip.nextExecutionDate = getNextSipDate(Number(sipDate));
    }

    await sip.save();
    res.json({ success: true, message: `SIP updated to ${sip.status}`, sip });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update SIP" });
  }
};
