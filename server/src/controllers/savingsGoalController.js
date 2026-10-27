
const mongoose = require("mongoose");
const SavingsGoal = require("../models/SavingsGoal");

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

// GET /api/goals
async function getGoals(req, res, next) {
  try {
    const goals = await SavingsGoal.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      goals: goals.map((goal) => ({
        ...goal,
        progress: Math.min(
          100,
          Math.round((goal.currentAmount / goal.targetAmount) * 100)
        ),
        remainingAmount: Math.max(
          0,
          goal.targetAmount - goal.currentAmount
        ),
        completed: goal.currentAmount >= goal.targetAmount,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/goals
async function createGoal(req, res, next) {
  try {
    const {
      title,
      description = "",
      targetAmount,
      targetDate,
      color = "#10B981",
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return sendError(res, 400, "Goal title is required");
    }

    if (title.trim().length > 80) {
      return sendError(res, 400, "Goal title cannot exceed 80 characters");
    }

    if (
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0
    ) {
      return sendError(
        res,
        400,
        "Target amount must be a number greater than zero"
      );
    }

    if (
      typeof description !== "string" ||
      description.length > 250
    ) {
      return sendError(res, 400, "Description must be 250 characters or fewer");
    }

    if (targetDate != null && targetDate !== "") {
      const parsedDate = new Date(targetDate);

      if (Number.isNaN(parsedDate.getTime())) {
        return sendError(res, 400, "Invalid target date");
      }
    }

    if (typeof color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return sendError(res, 400, "Color must be a valid hex color");
    }

    const goal = await SavingsGoal.create({
      user: req.user.id,
      title: title.trim(),
      description: description.trim(),
      targetAmount,
      targetDate: targetDate ? new Date(targetDate) : null,
      color,
    });

    return res.status(201).json({
      success: true,
      message: "Savings goal created successfully",
      goal,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/goals/:id
async function updateGoal(req, res, next) {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid goal ID");
    }

    const goal = await SavingsGoal.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!goal) {
      return sendError(res, 404, "Savings goal not found");
    }

    const { title, description, targetAmount, targetDate, color } = req.body;

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 80
      ) {
        return sendError(res, 400, "Enter a valid goal title (1–80 characters)");
      }
      goal.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || description.length > 250) {
        return sendError(res, 400, "Description must be 250 characters or fewer");
      }
      goal.description = description.trim();
    }

    if (targetAmount !== undefined) {
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        return sendError(res, 400, "Target amount must be greater than zero");
      }
      goal.targetAmount = targetAmount;
    }

    if (targetDate !== undefined) {
      if (targetDate === null || targetDate === "") {
        goal.targetDate = null;
      } else {
        const parsedDate = new Date(targetDate);

        if (Number.isNaN(parsedDate.getTime())) {
          return sendError(res, 400, "Invalid target date");
        }

        goal.targetDate = parsedDate;
      }
    }

    if (color !== undefined) {
      if (typeof color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return sendError(res, 400, "Color must be a valid hex color");
      }
      goal.color = color;
    }

    await goal.save();

    return res.json({
      success: true,
      message: "Savings goal updated successfully",
      goal,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/goals/:id/contributions
async function addContribution(req, res, next) {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid goal ID");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendError(res, 400, "Contribution must be greater than zero");
    }

    const goal = await SavingsGoal.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!goal) {
      return sendError(res, 404, "Savings goal not found");
    }

    goal.currentAmount += amount;
    await goal.save();

    return res.json({
      success: true,
      message: "Contribution added successfully",
      goal,
      progress: Math.min(
        100,
        Math.round((goal.currentAmount / goal.targetAmount) * 100)
      ),
      remainingAmount: Math.max(
        0,
        goal.targetAmount - goal.currentAmount
      ),
      completed: goal.currentAmount >= goal.targetAmount,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/goals/:id
async function deleteGoal(req, res, next) {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid goal ID");
    }

    const goal = await SavingsGoal.findOneAndDelete({
      _id: id,
      user: req.user.id,
    });

    if (!goal) {
      return sendError(res, 404, "Savings goal not found");
    }

    return res.json({
      success: true,
      message: "Savings goal deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  addContribution,
  deleteGoal,
};
