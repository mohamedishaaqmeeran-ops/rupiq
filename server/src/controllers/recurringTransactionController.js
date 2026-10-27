
const mongoose = require("mongoose");
const RecurringTransaction = require("../models/RecurringTransaction");

function getUserId(req) {
  return req.user?.id || req.user?._id || req.user?.userId || req.userId;
}

function validUserId(req, res) {
  const userId = getUserId(req);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    res.status(401).json({ message: "Invalid authentication" });
    return null;
  }

  return userId;
}

function parseDate(value) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

exports.createRecurringTransaction = async (req, res) => {
  try {
    const userId = validUserId(req, res);
    if (!userId) return;

    const {
      type,
      amount,
      category,
      description = "",
      frequency,
      startDate,
      endDate = null,
    } = req.body;

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

    if (
      typeof category !== "string" ||
      !category.trim() ||
      category.trim().length > 60
    ) {
      return res.status(400).json({ message: "Provide a valid category" });
    }

    if (!["daily", "weekly", "monthly", "yearly"].includes(frequency)) {
      return res.status(400).json({
        message: "Frequency must be daily, weekly, monthly, or yearly",
      });
    }

    if (typeof description !== "string" || description.length > 250) {
      return res.status(400).json({
        message: "Description cannot exceed 250 characters",
      });
    }

    const parsedStartDate = parseDate(startDate);

    if (!parsedStartDate) {
      return res.status(400).json({ message: "Provide a valid start date" });
    }

    const parsedEndDate = endDate === null || endDate === "" ? null : parseDate(endDate);

    if (endDate && !parsedEndDate) {
      return res.status(400).json({ message: "Provide a valid end date" });
    }

    if (parsedEndDate && parsedEndDate < parsedStartDate) {
      return res.status(400).json({
        message: "End date cannot be earlier than start date",
      });
    }

    const recurringTransaction = await RecurringTransaction.create({
      user: userId,
      type,
      amount: Number(amount),
      category: category.trim(),
      description: description.trim(),
      frequency,
      startDate: parsedStartDate,
      nextRunAt: parsedStartDate,
      endDate: parsedEndDate,
    });

    return res.status(201).json({
      message: "Recurring transaction created successfully",
      recurringTransaction,
    });
  } catch (error) {
    console.error("Create recurring transaction error:", error);
    return res.status(500).json({
      message: "Failed to create recurring transaction",
    });
  }
};

exports.getRecurringTransactions = async (req, res) => {
  try {
    const userId = validUserId(req, res);
    if (!userId) return;

    const recurringTransactions = await RecurringTransaction.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      recurringTransactions,
      count: recurringTransactions.length,
    });
  } catch (error) {
    console.error("Get recurring transactions error:", error);
    return res.status(500).json({
      message: "Failed to fetch recurring transactions",
    });
  }
};

exports.updateRecurringTransaction = async (req, res) => {
  try {
    const userId = validUserId(req, res);
    if (!userId) return;

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid recurring transaction ID" });
    }

    const allowedFields = [
      "type",
      "amount",
      "category",
      "description",
      "frequency",
      "startDate",
      "endDate",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        message: "Provide at least one field to update",
      });
    }

    if (
      updates.type !== undefined &&
      !["income", "expense"].includes(updates.type)
    ) {
      return res.status(400).json({ message: "Type must be income or expense" });
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
        return res.status(400).json({ message: "Provide a valid category" });
      }
      updates.category = updates.category.trim();
    }

    if (updates.description !== undefined) {
      if (typeof updates.description !== "string" || updates.description.length > 250) {
        return res.status(400).json({
          message: "Description cannot exceed 250 characters",
        });
      }
      updates.description = updates.description.trim();
    }

    if (
      updates.frequency !== undefined &&
      !["daily", "weekly", "monthly", "yearly"].includes(updates.frequency)
    ) {
      return res.status(400).json({
        message: "Invalid frequency",
      });
    }

    if (updates.startDate !== undefined) {
      const date = parseDate(updates.startDate);
      if (!date) {
        return res.status(400).json({ message: "Provide a valid start date" });
      }
      updates.startDate = date;
      updates.nextRunAt = date;
    }

    if (updates.endDate !== undefined) {
      if (updates.endDate === null || updates.endDate === "") {
        updates.endDate = null;
      } else {
        const date = parseDate(updates.endDate);
        if (!date) {
          return res.status(400).json({ message: "Provide a valid end date" });
        }
        updates.endDate = date;
      }
    }

    const existing = await RecurringTransaction.findOne({
      _id: id,
      user: userId,
    });

    if (!existing) {
      return res.status(404).json({ message: "Recurring transaction not found" });
    }

    const effectiveStart = updates.startDate ?? existing.startDate;
    const effectiveEnd =
      updates.endDate !== undefined ? updates.endDate : existing.endDate;

    if (effectiveEnd && effectiveEnd < effectiveStart) {
      return res.status(400).json({
        message: "End date cannot be earlier than start date",
      });
    }

    const recurringTransaction = await RecurringTransaction.findOneAndUpdate(
      { _id: id, user: userId, status: { $ne: "cancelled" } },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!recurringTransaction) {
      return res.status(400).json({
        message: "Cancelled recurring transactions cannot be edited",
      });
    }

    return res.json({
      message: "Recurring transaction updated successfully",
      recurringTransaction,
    });
  } catch (error) {
    console.error("Update recurring transaction error:", error);
    return res.status(500).json({
      message: "Failed to update recurring transaction",
    });
  }
};

async function changeStatus(req, res, status) {
  try {
    const userId = validUserId(req, res);
    if (!userId) return;

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid recurring transaction ID" });
    }

    const filter = { _id: id, user: userId };

    if (status === "active") {
      filter.status = "paused";
    } else if (status === "paused") {
      filter.status = "active";
    } else {
      filter.status = { $ne: "cancelled" };
    }

    const recurringTransaction = await RecurringTransaction.findOneAndUpdate(
      filter,
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!recurringTransaction) {
      return res.status(404).json({
        message: "Recurring transaction not found or cannot change status",
      });
    }

    return res.json({
      message: `Recurring transaction ${status} successfully`,
      recurringTransaction,
    });
  } catch (error) {
    console.error("Change recurring transaction status error:", error);
    return res.status(500).json({ message: "Failed to change status" });
  }
}

exports.pauseRecurringTransaction = (req, res) =>
  changeStatus(req, res, "paused");

exports.resumeRecurringTransaction = (req, res) =>
  changeStatus(req, res, "active");

exports.cancelRecurringTransaction = (req, res) =>
  changeStatus(req, res, "cancelled");
