const Notification = require("../models/Notification");
const Loan = require("../models/Loan");
const SIP = require("../models/SIP");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // Check dynamic live alerts (Loans, SIPs, Budgets)
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [loans, sips, budgets, monthExpenses] = await Promise.all([
      Loan.find({ user: userId, status: "Active" }),
      SIP.find({ user: userId, status: "ACTIVE" }),
      Budget.find({ user: userId, month: currentMonth }),
      Transaction.find({
        user: userId,
        type: "expense",
        date: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        },
      }),
    ]);

    // Compute category spent for budget alerts
    const categorySpent = {};
    monthExpenses.forEach((tx) => {
      categorySpent[tx.category] = (categorySpent[tx.category] || 0) + tx.amount;
    });

    const dynamicAlerts = [];

    // 1. Loan EMI reminders
    loans.forEach((loan) => {
      const nextDue = new Date(loan.nextDueDate);
      const diffDays = Math.ceil((nextDue - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7 && diffDays >= -2) {
        dynamicAlerts.push({
          id: `loan_${loan._id}`,
          title: `EMI Due: ${loan.name}`,
          message: `₹${(loan.monthlyEmi || 0).toLocaleString("en-IN")} is due ${diffDays === 0 ? "today!" : diffDays > 0 ? `in ${diffDays} days` : "overdue!"}`,
          type: "loan",
          priority: diffDays <= 1 ? "critical" : "high",
          actionTab: "loans",
          createdAt: new Date(),
        });
      }
    });

    // 2. SIP reminders
    sips.forEach((sip) => {
      const nextDate = new Date(sip.nextExecutionDate);
      const diffDays = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 5 && diffDays >= 0) {
        dynamicAlerts.push({
          id: `sip_${sip._id}`,
          title: `Upcoming SIP: ${sip.schemeName || "Mutual Fund"}`,
          message: `₹${(sip.amount || 0).toLocaleString("en-IN")} will be auto-debited in ${diffDays} day${diffDays === 1 ? "" : "s"}.`,
          type: "sip",
          priority: "normal",
          actionTab: "investments",
          createdAt: new Date(),
        });
      }
    });

    // 3. Budget threshold alerts
    budgets.forEach((b) => {
      const spent = categorySpent[b.category] || 0;
      const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      if (pct >= 90) {
        dynamicAlerts.push({
          id: `budget_${b._id}`,
          title: `Budget Alert: ${b.category}`,
          message: `You've used ${pct}% of your ₹${b.amount.toLocaleString("en-IN")} limit (₹${spent.toLocaleString("en-IN")} spent).`,
          type: "budget",
          priority: pct >= 100 ? "critical" : "high",
          actionTab: "budgets",
          createdAt: new Date(),
        });
      }
    });

    // Saved database notifications
    const dbNotifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(20);

    const allNotifications = [...dynamicAlerts, ...dbNotifications];

    res.status(200).json({
      success: true,
      count: allNotifications.length,
      unreadCount: allNotifications.filter((n) => !n.isRead).length,
      notifications: allNotifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/notifications
exports.createNotification = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { title, message, type = "reminder", priority = "normal", actionLink } = req.body;

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      priority,
      actionLink,
    });

    res.status(201).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    await Notification.updateMany({ _id: req.params.id, user: userId }, { isRead: true });
    res.status(200).json({ success: true, message: "Marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
