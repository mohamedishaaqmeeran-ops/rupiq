
const mongoose = require("mongoose");
const InvestmentTransaction = require("../models/InvestmentTransaction");
const VirtualPortfolio = require("../models/VirtualPortfolio");

const roundMoney = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const VALID_ASSET_TYPES = [
  "stock",
  "mutual_fund",
  "etf",
  "bond",
  "gold",
  "crypto",
];

// POST /api/investments/transactions
exports.createTransaction = async (req, res) => {
  const userId = req.user?.id;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(401).json({
      success: false,
      message: "Authenticated user ID is missing or invalid.",
    });
  }

  let session;

  try {
    const {
      assetType,
      symbol,
      assetName,
      transactionType,
      quantity,
      pricePerUnit,
      fees = 0,
      transactionDate,
      notes = "",
    } = req.body;

    // Validate request data.
    if (
      !VALID_ASSET_TYPES.includes(assetType) ||
      typeof symbol !== "string" ||
      !symbol.trim() ||
      typeof assetName !== "string" ||
      !assetName.trim() ||
      !["buy", "sell"].includes(transactionType) ||
      typeof quantity === "boolean" ||
      quantity === "" ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) <= 0 ||
      typeof pricePerUnit === "boolean" ||
      pricePerUnit === "" ||
      !Number.isFinite(Number(pricePerUnit)) ||
      Number(pricePerUnit) <= 0 ||
      typeof fees === "boolean" ||
      !Number.isFinite(Number(fees)) ||
      Number(fees) < 0 ||
      typeof notes !== "string" ||
      notes.length > 500 ||
      (transactionDate &&
        (typeof transactionDate !== "string" ||
          !Number.isFinite(Date.parse(transactionDate)))) ||
      (transactionDate &&
        new Date(transactionDate).getTime() > Date.now())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid investment transaction details.",
      });
    }

    const qty = Number(quantity);
    const price = Number(pricePerUnit);
    const feeAmount = Number(fees);
    const grossAmount = roundMoney(qty * price);

    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Transaction amount is invalid.",
      });
    }

    const totalCost = roundMoney(grossAmount + feeAmount);
    const netProceeds = roundMoney(grossAmount - feeAmount);

    if (transactionType === "sell" && netProceeds < 0) {
      return res.status(400).json({
        success: false,
        message: "Fees cannot exceed the sale value.",
      });
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    const userObjectId = new mongoose.Types.ObjectId(userId);

    let createdTransaction;
    let updatedPortfolio;

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Find or initialize the user's virtual portfolio.
      let portfolio = await VirtualPortfolio.findOne({
        user: userObjectId,
      }).session(session);

      if (!portfolio) {
        portfolio = new VirtualPortfolio({
          user: userObjectId,
          startingCash: 100000,
          availableCash: 100000,
        });

        await portfolio.save({ session });
      }

      if (transactionType === "buy") {
        // Debit cash only if enough virtual cash is available.
        const debit = await VirtualPortfolio.updateOne(
          {
            _id: portfolio._id,
            user: userObjectId,
            availableCash: { $gte: totalCost },
          },
          {
            $inc: { availableCash: -totalCost },
          },
          { session }
        );

        if (debit.modifiedCount !== 1) {
          throw new Error("INSUFFICIENT_VIRTUAL_CASH");
        }
      } else {
        // Calculate currently held units from the virtual ledger.
        const holdings = await InvestmentTransaction.aggregate([
          {
            $match: {
              user: userObjectId,
              portfolioMode: "virtual",
              symbol: normalizedSymbol,
              assetType,
            },
          },
          {
            $group: {
              _id: null,
              units: {
                $sum: {
                  $cond: [
                    { $eq: ["$transactionType", "buy"] },
                    "$quantity",
                    { $multiply: ["$quantity", -1] },
                  ],
                },
              },
            },
          },
        ]).session(session);

        const availableUnits = holdings[0]?.units || 0;

        if (qty > availableUnits + 1e-8) {
          throw new Error("INSUFFICIENT_HOLDINGS");
        }

        // Credit the net proceeds from the sale.
        const credit = await VirtualPortfolio.updateOne(
          {
            _id: portfolio._id,
            user: userObjectId,
          },
          {
            $inc: { availableCash: netProceeds },
          },
          { session }
        );

        if (credit.modifiedCount !== 1) {
          throw new Error("PORTFOLIO_UPDATE_FAILED");
        }
      }

      // Record the transaction in the same database transaction.
      const transactions = await InvestmentTransaction.create(
        [
          {
            user: userObjectId,
            portfolioMode: "virtual",
            assetType,
            symbol: normalizedSymbol,
            assetName: assetName.trim(),
            transactionType,
            quantity: qty,
            pricePerUnit: price,
            fees: feeAmount,
            transactionDate: transactionDate
              ? new Date(transactionDate)
              : new Date(),
            notes: notes.trim(),
          },
        ],
        { session }
      );

      createdTransaction = transactions[0];

      updatedPortfolio = await VirtualPortfolio.findOne({
        _id: portfolio._id,
        user: userObjectId,
      }).session(session);
    });

    return res.status(201).json({
      success: true,
      message: "Virtual investment transaction recorded.",
      transaction: createdTransaction,
      portfolio: updatedPortfolio,
    });
  } catch (error) {
    if (error.message === "INSUFFICIENT_VIRTUAL_CASH") {
      return res.status(400).json({
        success: false,
        message:
          "Insufficient virtual cash for this purchase, including fees.",
      });
    }

    if (error.message === "INSUFFICIENT_HOLDINGS") {
      return res.status(400).json({
        success: false,
        message: "You cannot sell more units than you currently hold.",
      });
    }

    if (error.message === "PORTFOLIO_UPDATE_FAILED") {
      return res.status(409).json({
        success: false,
        message: "Portfolio changed unexpectedly. Please retry.",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create investment transaction error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record investment transaction.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// GET /api/investments/transactions
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID is missing or invalid.",
      });
    }

    const transactions = await InvestmentTransaction.find({
      user: userId,
      portfolioMode: "virtual",
    }).sort({ transactionDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Get investment transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch investment transactions.",
    });
  }
};

// DELETE /api/investments/transactions/:id
// Direct deletion is disabled to preserve portfolio ledger consistency.
exports.deleteTransaction = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction ID.",
    });
  }

  return res.status(409).json({
    success: false,
    message:
      "Transactions cannot be deleted directly. Reversal support is required.",
  });
};
