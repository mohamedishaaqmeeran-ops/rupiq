
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

function getUserId(req) {
  return req.user?.id || req.user?._id || req.user?.userId || req.userId;
}

exports.createTransaction = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type, amount, category, description, date } = req.body;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({
        message: "Type must be income or expense",
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        message: "Enter a valid amount greater than zero",
      });
    }

    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({
        message: "Category is required",
      });
    }

    const transactionDate = date ? new Date(date) : new Date();

    if (Number.isNaN(transactionDate.getTime())) {
      return res.status(400).json({ message: "Invalid transaction date" });
    }

    const transaction = await Transaction.create({
      user: userId,
      type,
      amount: Number(amount),
      category: category.trim(),
      description:
        typeof description === "string" ? description.trim() : "",
      date: transactionDate,
    });

    return res.status(201).json({
      message: "Transaction created successfully",
      transaction,
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    return res.status(500).json({ message: "Failed to create transaction" });
  }
};


exports.getTransactions = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid authentication",
      });
    }

    const filter = { user: userId };
    const { month } = req.query;

    if (month !== undefined) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({
          message: "Month must use YYYY-MM format",
        });
      }

      const [year, monthNumber] = month.split("-").map(Number);

      filter.date = {
        $gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
        $lt: new Date(Date.UTC(year, monthNumber, 1)),
      };
    }

    const transactions = await Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(500)
      .lean();

    return res.status(200).json({
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json({
      message: "Failed to fetch transactions",
    });
  }
};

exports.getTransactionSummary = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid authentication",
      });
    }

    const { month } = req.query;
    const match = {
      user: new mongoose.Types.ObjectId(userId),
    };

    if (month !== undefined) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({
          message: "Month must use YYYY-MM format",
        });
      }

      const [year, monthNumber] = month.split("-").map(Number);

      match.date = {
        $gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
        $lt: new Date(Date.UTC(year, monthNumber, 1)),
      };
    }

    const result = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const income =
      result.find((item) => item._id === "income")?.total || 0;
    const expenses =
      result.find((item) => item._id === "expense")?.total || 0;

    return res.status(200).json({
      income,
      expenses,
      balance: income - expenses,
    });
  } catch (error) {
    console.error("Transaction summary error:", error);
    return res.status(500).json({
      message: "Failed to fetch transaction summary",
    });
  }
};



exports.updateTransaction = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }

    const allowedFields = [
      "type",
      "amount",
      "category",
      "description",
      "date",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update",
      });
    }

    if (
      updates.type !== undefined &&
      !["income", "expense"].includes(updates.type)
    ) {
      return res.status(400).json({
        message: "Type must be income or expense",
      });
    }

    if (updates.amount !== undefined) {
      if (
        updates.amount === null ||
        updates.amount === "" ||
        !Number.isFinite(Number(updates.amount)) ||
        Number(updates.amount) <= 0
      ) {
        return res.status(400).json({
          message: "Amount must be greater than zero",
        });
      }

      updates.amount = Number(updates.amount);
    }

    if (updates.category !== undefined) {
      if (
        typeof updates.category !== "string" ||
        !updates.category.trim() ||
        updates.category.trim().length > 60
      ) {
        return res.status(400).json({
          message: "Provide a valid category",
        });
      }

      updates.category = updates.category.trim();
    }

    if (updates.description !== undefined) {
      if (typeof updates.description !== "string") {
        return res.status(400).json({
          message: "Description must be text",
        });
      }

      updates.description = updates.description.trim();

      if (updates.description.length > 250) {
        return res.status(400).json({
          message: "Description cannot exceed 250 characters",
        });
      }
    }

    if (updates.date !== undefined) {
      const parsedDate = new Date(updates.date);

      if (
        updates.date === null ||
        updates.date === "" ||
        Number.isNaN(parsedDate.getTime())
      ) {
        return res.status(400).json({
          message: "Provide a valid date",
        });
      }

      updates.date = parsedDate;
    }

    // Ownership is enforced in the database query.
    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    return res.json({
      message: "Transaction updated successfully",
      transaction,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    return res.status(500).json({
      message: "Failed to update transaction",
    });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "Invalid authentication" });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      user: userId,
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    return res.json({
      message: "Transaction deleted successfully",
      transactionId: id,
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return res.status(500).json({
      message: "Failed to delete transaction",
    });
  }
};

