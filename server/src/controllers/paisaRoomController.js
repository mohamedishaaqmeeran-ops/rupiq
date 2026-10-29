const PaisaRoom = require("../models/PaisaRoom");

const DEFAULT_ROOMS = [
  {
    name: "Goa Beach Villa Trip",
    category: "Trip",
    color: "#F5D084",
    members: [
      { name: "You (Ishaaq)", upiId: "ishaaq@okaxis", avatarColor: "#F5D084" },
      { name: "Rohan", upiId: "rohan@okhdfcbank", avatarColor: "#38BDF8" },
      { name: "Sameer", upiId: "sameer@oksbi", avatarColor: "#10B981" },
      { name: "Pooja", upiId: "pooja@icici", avatarColor: "#C084FC" },
    ],
    expenses: [
      {
        title: "Villa Airbnb Booking (3 Nights)",
        amount: 24000,
        paidBy: "You (Ishaaq)",
        splitBetween: ["You (Ishaaq)", "Rohan", "Sameer", "Pooja"],
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Thalassa Beach Club Dinner",
        amount: 8800,
        paidBy: "Rohan",
        splitBetween: ["You (Ishaaq)", "Rohan", "Sameer", "Pooja"],
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Scooter Rentals & Petrol",
        amount: 3200,
        paidBy: "Sameer",
        splitBetween: ["You (Ishaaq)", "Rohan", "Sameer", "Pooja"],
        date: new Date(),
      },
    ],
  },
  {
    name: "Apartment 402 Flatmates",
    category: "Flatmates",
    color: "#38BDF8",
    members: [
      { name: "You (Ishaaq)", upiId: "ishaaq@okaxis", avatarColor: "#F5D084" },
      { name: "Aditya", upiId: "aditya@okaxis", avatarColor: "#EC4899" },
      { name: "Vikram", upiId: "vikram@paytm", avatarColor: "#3B82F6" },
    ],
    expenses: [
      {
        title: "Airtel Xstream Fiber 300 Mbps",
        amount: 1180,
        paidBy: "You (Ishaaq)",
        splitBetween: ["You (Ishaaq)", "Aditya", "Vikram"],
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Drinking Water Cans & Maid Supplies",
        amount: 1450,
        paidBy: "Aditya",
        splitBetween: ["You (Ishaaq)", "Aditya", "Vikram"],
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
  },
];

function computeBalances(members, expenses) {
  const balances = {};
  members.forEach((m) => {
    balances[m.name] = 0;
  });

  expenses.forEach((exp) => {
    const paidBy = exp.paidBy;
    const splitCount = exp.splitBetween.length || 1;
    const splitShare = exp.amount / splitCount;

    if (balances[paidBy] === undefined) balances[paidBy] = 0;
    balances[paidBy] += exp.amount;

    exp.splitBetween.forEach((person) => {
      if (balances[person] === undefined) balances[person] = 0;
      balances[person] -= splitShare;
    });
  });

  // Simplified Debt Settlements: Find who owes whom
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([name, net]) => {
    const rounded = Math.round(net);
    if (rounded < -1) debtors.push({ name, amount: -rounded });
    else if (rounded > 1) creditors.push({ name, amount: rounded });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const settleAmt = Math.min(debtor.amount, creditor.amount);

    if (settleAmt > 0) {
      const creditorMember = members.find((m) => m.name === creditor.name);
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: settleAmt,
        upiId: creditorMember ? creditorMember.upiId : "",
      });
    }

    debtor.amount -= settleAmt;
    creditor.amount -= settleAmt;

    if (debtor.amount <= 1) dIdx++;
    if (creditor.amount <= 1) cIdx++;
  }

  return { balances, settlements };
}

exports.getRooms = async (req, res) => {
  try {
    const userId = req.user._id;
    let rooms = await PaisaRoom.find({ creator: userId }).sort({ updatedAt: -1 });

    if (rooms.length === 0) {
      const seeded = DEFAULT_ROOMS.map((r) => ({ ...r, creator: userId }));
      rooms = await PaisaRoom.insertMany(seeded);
    }

    const roomsWithCalculations = rooms.map((room) => {
      const { balances, settlements } = computeBalances(room.members, room.expenses);
      const totalSpend = room.expenses.reduce((sum, e) => sum + e.amount, 0);
      return {
        ...room.toObject(),
        totalSpend,
        balances,
        settlements,
      };
    });

    res.json({ success: true, data: roomsWithCalculations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const { name, category, members, color } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Room name is required" });

    const room = await PaisaRoom.create({
      creator: req.user._id,
      name,
      category: category || "Trip",
      color: color || "#F5D084",
      members: members || [
        { name: "You", upiId: "ishaaq@okaxis", avatarColor: "#F5D084" },
      ],
      expenses: [],
    });

    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, paidBy, splitBetween } = req.body;
    if (!title || !amount || !paidBy) {
      return res.status(400).json({ success: false, message: "Title, amount, and paidBy required" });
    }

    const room = await PaisaRoom.findOne({ _id: id, creator: req.user._id });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    room.expenses.unshift({
      title,
      amount: Number(amount),
      paidBy,
      splitBetween: splitBetween && splitBetween.length > 0 ? splitBetween : room.members.map((m) => m.name),
      date: new Date(),
    });

    await room.save();
    const { balances, settlements } = computeBalances(room.members, room.expenses);

    res.json({
      success: true,
      data: {
        ...room.toObject(),
        totalSpend: room.expenses.reduce((sum, e) => sum + e.amount, 0),
        balances,
        settlements,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await PaisaRoom.findOneAndDelete({ _id: id, creator: req.user._id });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    res.json({ success: true, message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
