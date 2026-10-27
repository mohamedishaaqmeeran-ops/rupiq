
const mongoose = require("mongoose");
const InvestmentTransaction = require("../models/InvestmentTransaction");
const VirtualPortfolio = require("../models/VirtualPortfolio");

const roundMoney = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

// GET /api/investments/summary
exports.getInvestmentSummary = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID is missing or invalid.",
      });
    }

    let portfolio = await VirtualPortfolio.findOne({
      user: userId,
    });

    if (!portfolio) {
      portfolio = await VirtualPortfolio.create({
        user: userId,
        startingCash: 100000,
        availableCash: 100000,
      });
    }

    const transactions = await InvestmentTransaction.find({
      user: userId,
      portfolioMode: "virtual",
    })
      .sort({ transactionDate: 1, createdAt: 1, _id: 1 })
      .lean();

    const assetMap = new Map();

    let realizedProfitLoss = 0;

    for (const transaction of transactions) {
      const key = `${transaction.assetType}:${transaction.symbol}`;

      if (!assetMap.has(key)) {
        assetMap.set(key, {
          assetType: transaction.assetType,
          symbol: transaction.symbol,
          assetName: transaction.assetName,
          quantity: 0,
          costBasis: 0,
          totalBought: 0,
          totalSold: 0,
          buyFees: 0,
          sellFees: 0,
          realizedProfitLoss: 0,
        });
      }

      const holding = assetMap.get(key);
      const quantity = transaction.quantity;
      const grossValue = quantity * transaction.pricePerUnit;
      const fees = transaction.fees || 0;

      if (transaction.transactionType === "buy") {
        holding.quantity += quantity;
        holding.costBasis += grossValue + fees;
        holding.totalBought += grossValue;
        holding.buyFees += fees;
      } else {
        if (quantity > holding.quantity + 1e-8) {
          return res.status(500).json({
            success: false,
            message:
              `Invalid transaction history for ${transaction.symbol}. ` +
              "A sale exceeds the recorded holdings.",
          });
        }

        const averageCost =
          holding.quantity > 0
            ? holding.costBasis / holding.quantity
            : 0;

        const costRemoved = averageCost * quantity;
        const saleProfitLoss = grossValue - fees - costRemoved;

        holding.quantity = Math.max(0, holding.quantity - quantity);
        holding.costBasis = Math.max(0, holding.costBasis - costRemoved);
        holding.totalSold += grossValue;
        holding.sellFees += fees;
        holding.realizedProfitLoss += saleProfitLoss;

        realizedProfitLoss += saleProfitLoss;
      }

      holding.quantity = Math.abs(holding.quantity) < 1e-8
        ? 0
        : holding.quantity;

      if (holding.quantity === 0) {
        holding.costBasis = 0;
      }
    }

    const holdings = [...assetMap.values()]
      .filter((holding) => holding.quantity > 0)
      .map((holding) => ({
        assetType: holding.assetType,
        symbol: holding.symbol,
        assetName: holding.assetName,
        quantity: Number(holding.quantity.toFixed(8)),
        averageCostPerUnit: Number(
          (holding.costBasis / holding.quantity).toFixed(4)
        ),
        costBasis: roundMoney(holding.costBasis),
        totalBought: roundMoney(holding.totalBought),
        totalSold: roundMoney(holding.totalSold),
        buyFees: roundMoney(holding.buyFees),
        sellFees: roundMoney(holding.sellFees),
        realizedProfitLoss: roundMoney(holding.realizedProfitLoss),
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return res.status(200).json({
      success: true,
      summary: {
        currency: "INR",
        portfolioMode: "virtual",
        startingCash: portfolio.startingCash,
        availableCash: portfolio.availableCash,
        holdingsCount: holdings.length,
        totalCostBasis: roundMoney(
          holdings.reduce((sum, holding) => sum + holding.costBasis, 0)
        ),
        realizedProfitLoss: roundMoney(realizedProfitLoss),
        currentMarketValue: null,
        unrealizedProfitLoss: null,
        note:
          "Cost basis uses the moving-average method. Current market value " +
          "and unrealized profit/loss require reliable market prices.",
      },
      holdings,
    });
  } catch (error) {
    console.error("Get investment summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to calculate investment summary.",
    });
  }
};
