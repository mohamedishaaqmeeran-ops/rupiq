const mongoose = require("mongoose");
const User = require("../models/User");

// ─── Platform Stats ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 * Returns high-level platform analytics for the admin dashboard.
 */
async function getPlatformStats(req, res, next) {
  try {
    const Transaction = mongoose.model("Transaction");
    const Loan        = mongoose.model("Loan");
    const Goal        = mongoose.model("SavingsGoal");
    const Investment  = mongoose.model("InvestmentTransaction");

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      guestUsers,
      adminUsers,
      totalTransactions,
      totalLoans,
      totalGoals,
      totalInvestments,
      recentUsers,
      incomeAgg,
      expenseAgg,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      User.countDocuments({ status: "suspended" }),
      User.countDocuments({ role: "guest" }),
      User.countDocuments({ role: { $in: ["admin", "super_admin"] } }),
      Transaction.countDocuments(),
      Loan.countDocuments(),
      Goal.countDocuments(),
      Investment.countDocuments(),
      // 5 newest users
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email role status createdAt"),
      // total income across platform
      Transaction.aggregate([
        { $match: { type: "income" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // total expenses across platform
      Transaction.aggregate([
        { $match: { type: "expense" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const platformIncome  = incomeAgg[0]?.total  ?? 0;
    const platformExpense = expenseAgg[0]?.total  ?? 0;

    // Users registered per day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailySignups = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          guests: guestUsers,
          admins: adminUsers,
        },
        platform: {
          totalTransactions,
          totalLoans,
          totalGoals,
          totalInvestments,
          totalIncome: platformIncome,
          totalExpenses: platformExpense,
          netFlow: platformIncome - platformExpense,
        },
        recentUsers,
        dailySignups,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── User Management ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/users?page=1&limit=20&search=&role=&status=
 */
async function listUsers(req, res, next) {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? "1",  10));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20", 10)));
    const skip   = (page - 1) * limit;

    const filter = {};
    if (req.query.role   && req.query.role   !== "all") filter.role   = req.query.role;
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(req.query.search, "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("name email role status currency createdAt updatedAt"),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      users,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/users/:id
 */
async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id)
      .select("name email role status currency createdAt updatedAt");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/users/:id/role
 * Body: { role: "user" | "admin" | "super_admin" | "guest" }
 * Only super_admin can promote to admin/super_admin.
 */
async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    const allowed  = ["user", "admin", "super_admin", "guest"];

    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Only super_admin can assign admin/super_admin roles
    if (
      ["admin", "super_admin"].includes(role) &&
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only a super_admin can assign elevated roles",
      });
    }

    // Prevent self-demotion
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "Cannot change your own role" });
    }

    // role is immutable on the schema — use findByIdAndUpdate with $set at DB level
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true, runValidators: false }
    ).select("name email role status");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: `Role updated to ${role}`, user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Body: { status: "active" | "suspended" }
 */
async function updateUserStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "Cannot change your own status" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select("name email role status");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: `User ${status === "suspended" ? "suspended" : "reactivated"}`,
      user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/users/:id
 * Hard-deletes a user and all their associated data.
 */
async function deleteUser(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "Cannot delete yourself" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userId = user._id;

    // Delete all data belonging to the user in parallel
    const Transaction = mongoose.model("Transaction");
    await Promise.all([
      Transaction.deleteMany({ user: userId }),
      mongoose.model("Budget")?.deleteMany({ user: userId }).catch(() => {}),
      mongoose.model("SavingsGoal")?.deleteMany({ user: userId }).catch(() => {}),
      mongoose.model("Loan")?.deleteMany({ user: userId }).catch(() => {}),
      mongoose.model("InvestmentTransaction")?.deleteMany({ user: userId }).catch(() => {}),
      mongoose.model("Account")?.deleteMany({ user: userId }).catch(() => {}),
      mongoose.model("RecurringTransaction")?.deleteMany({ user: userId }).catch(() => {}),
    ]);

    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: "User and all associated data deleted" });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/guests/cleanup
 * Removes all guest accounts older than 24 hours.
 */
async function cleanupGuests(req, res, next) {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldGuests = await User.find({
      role: "guest",
      createdAt: { $lt: cutoff },
    }).select("_id");

    const ids = oldGuests.map((g) => g._id);

    if (ids.length === 0) {
      return res.json({ success: true, message: "No stale guest accounts found", deleted: 0 });
    }

    const Transaction = mongoose.model("Transaction");
    await Promise.all([
      Transaction.deleteMany({ user: { $in: ids } }),
      mongoose.model("Account")?.deleteMany({ user: { $in: ids } }).catch(() => {}),
      mongoose.model("Budget")?.deleteMany({ user: { $in: ids } }).catch(() => {}),
      mongoose.model("SavingsGoal")?.deleteMany({ user: { $in: ids } }).catch(() => {}),
    ]);

    const { deletedCount } = await User.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} stale guest account(s)`,
      deleted: deletedCount,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPlatformStats,
  listUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  cleanupGuests,
};
