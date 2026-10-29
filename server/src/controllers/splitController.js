const SplitGroup = require("../models/SplitGroup");
const SplitExpense = require("../models/SplitExpense");
const Transaction = require("../models/Transaction");

// GET /api/split/groups
exports.getGroups = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groups = await SplitGroup.find({ user: userId }).sort({ updatedAt: -1 });

    // Fetch expense totals for each group
    const groupsWithSummary = await Promise.all(
      groups.map(async (group) => {
        const expenses = await SplitExpense.find({ group: group._id });
        const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
        let userBalance = 0; // positive = others owe user, negative = user owes others

        expenses.forEach((exp) => {
          const isUserPayer = exp.paidBy.toLowerCase() === "you" || exp.paidBy.toLowerCase() === req.user.name.toLowerCase();
          exp.shares.forEach((share) => {
            if (isUserPayer && share.memberName.toLowerCase() !== exp.paidBy.toLowerCase() && !share.settled) {
              userBalance += share.amount;
            } else if (!isUserPayer && (share.memberName.toLowerCase() === "you" || share.memberName.toLowerCase() === req.user.name.toLowerCase()) && !share.settled) {
              userBalance -= share.amount;
            }
          });
        });

        return {
          ...group.toObject(),
          totalSpent: Math.round(totalSpent * 100) / 100,
          userBalance: Math.round(userBalance * 100) / 100,
          expensesCount: expenses.length,
        };
      })
    );

    res.status(200).json({ success: true, groups: groupsWithSummary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/split/groups
exports.createGroup = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { name, category = "Trip", description = "", members = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required." });
    }

    // Always include user in group members
    const memberList = [{ name: req.user.name || "You", isUser: true, user: userId }];
    if (Array.isArray(members)) {
      members.forEach((m) => {
        const mName = typeof m === "string" ? m.trim() : (m.name || "").trim();
        if (mName && mName.toLowerCase() !== "you" && mName.toLowerCase() !== (req.user.name || "").toLowerCase()) {
          memberList.push({ name: mName, email: m.email || "", phone: m.phone || "" });
        }
      });
    }

    const group = await SplitGroup.create({
      user: userId,
      name: name.trim(),
      category,
      description,
      members: memberList,
    });

    res.status(201).json({ success: true, group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/split/groups/:id
exports.getGroupDetails = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const group = await SplitGroup.findOne({ _id: req.params.id, user: userId });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found." });
    }

    const expenses = await SplitExpense.find({ group: group._id }).sort({ date: -1 });

    // Calculate balances for each member
    const balanceMap = {};
    group.members.forEach((m) => {
      balanceMap[m.name] = 0;
    });

    expenses.forEach((exp) => {
      const payer = exp.paidBy;
      if (balanceMap[payer] === undefined) balanceMap[payer] = 0;

      exp.shares.forEach((share) => {
        if (!share.settled) {
          if (balanceMap[share.memberName] === undefined) balanceMap[share.memberName] = 0;
          if (share.memberName !== payer) {
            balanceMap[payer] += share.amount;
            balanceMap[share.memberName] -= share.amount;
          }
        }
      });
    });

    const balances = Object.keys(balanceMap).map((name) => ({
      name,
      balance: Math.round(balanceMap[name] * 100) / 100,
    }));

    res.status(200).json({
      success: true,
      group,
      expenses,
      balances,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/split/groups/:id/expenses
exports.addExpense = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { title, amount, paidBy = "You", splitType = "equal", shares = [], category = "Dining", recordInLedger = true } = req.body;

    const group = await SplitGroup.findOne({ _id: req.params.id, user: userId });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found." });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid expense amount required." });
    }

    let calculatedShares = [];
    if (splitType === "equal" || !shares.length) {
      const memberCount = group.members.length || 1;
      const sharePerPerson = Math.round((numAmount / memberCount) * 100) / 100;
      calculatedShares = group.members.map((m) => ({
        memberName: m.name,
        amount: sharePerPerson,
        settled: m.name === paidBy,
      }));
    } else {
      calculatedShares = shares.map((s) => ({
        memberName: s.memberName,
        amount: parseFloat(s.amount) || 0,
        settled: s.memberName === paidBy,
      }));
    }

    const expense = await SplitExpense.create({
      group: group._id,
      user: userId,
      title: title || "Shared Expense",
      amount: numAmount,
      paidBy,
      splitType,
      category,
      shares: calculatedShares,
    });

    // Optionally record user's personal share in Transactions
    if (recordInLedger) {
      const userShareObj = calculatedShares.find(
        (s) => s.memberName.toLowerCase() === "you" || s.memberName.toLowerCase() === (req.user.name || "").toLowerCase()
      );
      const userShareAmount = userShareObj ? userShareObj.amount : (paidBy === "You" ? numAmount : 0);

      if (userShareAmount > 0) {
        await Transaction.create({
          user: userId,
          type: "expense",
          amount: userShareAmount,
          category: category || "Dining",
          description: `PaisaSplit: ${title} (${group.name})`,
          paymentMethod: "UPI",
          date: new Date(),
        });
      }
    }

    res.status(201).json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/split/expenses/:id/settle
exports.settleShare = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { memberName } = req.body;

    const expense = await SplitExpense.findOne({ _id: req.params.id, user: userId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found." });
    }

    let updated = false;
    expense.shares.forEach((s) => {
      if (!memberName || s.memberName.toLowerCase() === memberName.toLowerCase()) {
        s.settled = true;
        s.settledAt = new Date();
        updated = true;
      }
    });

    if (updated) {
      await expense.save();
    }

    res.status(200).json({ success: true, message: "Share marked as settled.", expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
