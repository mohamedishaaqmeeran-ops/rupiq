
const mongoose = require("mongoose");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");

function getUserId(req) {
  return req.user?.id || req.user?._id || req.user?.userId;
}

function validMonth(month) {
  return (
    typeof month === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  );
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    $gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    $lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

exports.getBudgets = async (req, res) => {
  try {
    const userId = getUserId(req);
    const month = req.query.month;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    if (!validMonth(month)) {
      return res.status(400).json({
        message: "Provide month in YYYY-MM format",
      });
    }

    const [budgets, spending] = await Promise.all([
      Budget.find({ user: userId, month }).sort({ category: 1 }).lean(),
      Transaction.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            type: "expense",
            date: monthRange(month),
          },
        },
        {
          $group: {
            _id: "$category",
            spent: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const spendingByCategory = new Map(
      spending.map((item) => [item._id.toLowerCase(), item.spent])
    );

    const result = budgets.map((budget) => {
  const spent =
    spendingByCategory.get(budget.category.toLowerCase()) || 0;

  const remaining = budget.limit - spent;
  const percentUsed = (spent / budget.limit) * 100;

  const status =
    percentUsed >= 100
      ? "exceeded"
      : percentUsed >= 80
        ? "warning"
        : "on_track";

  const alertMessage =
    status === "exceeded"
      ? `Budget exceeded by ₹${Math.max(0, spent - budget.limit).toFixed(2)}`
      : status === "warning"
        ? `You've used ${Math.round(percentUsed)}% of this budget`
        : "";

  return {
    ...budget,
    spent,
    remaining,
    percentUsed: Math.round(percentUsed * 10) / 10,
    status,
    alertMessage,
  };
});

    return res.json({
      month,
      budgets: result,
      totalLimit: result.reduce((sum, item) => sum + item.limit, 0),
      totalSpent: result.reduce((sum, item) => sum + item.spent, 0),
    });
  } catch (error) {
    console.error("Get budgets error:", error);
    return res.status(500).json({ message: "Failed to fetch budgets" });
  }
};

exports.createOrUpdateBudget = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { category, month, limit } = req.body;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ message: "Category is required" });
    }

    if (category.trim().length > 60) {
      return res.status(400).json({ message: "Category is too long" });
    }

    if (!validMonth(month)) {
      return res.status(400).json({
        message: "Month must use YYYY-MM format",
      });
    }

    if (
      limit === undefined ||
      limit === null ||
      limit === "" ||
      !Number.isFinite(Number(limit)) ||
      Number(limit) <= 0
    ) {
      return res.status(400).json({
        message: "Budget limit must be greater than zero",
      });
    }

    const budget = await Budget.findOneAndUpdate(
      {
        user: userId,
        category: category.trim(),
        month,
      },
      {
        $set: {
          limit: Number(limit),
        },
        $setOnInsert: {
          user: userId,
          category: category.trim(),
          month,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      message: "Budget saved successfully",
      budget,
    });
  } catch (error) {
    console.error("Save budget error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A budget already exists for this category and month",
      });
    }

    return res.status(500).json({ message: "Failed to save budget" });
  }
};

exports.deleteBudget = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid budget ID" });
    }

    const budget = await Budget.findOneAndDelete({
      _id: id,
      user: userId,
    });

    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }

    return res.json({ message: "Budget deleted successfully" });
  } catch (error) {
    console.error("Delete budget error:", error);
    return res.status(500).json({ message: "Failed to delete budget" });
  }
};
