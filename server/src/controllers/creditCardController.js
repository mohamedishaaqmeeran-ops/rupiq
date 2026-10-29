const CreditCard = require("../models/CreditCard");

const DEFAULT_CARDS = [
  {
    cardName: "Infinia Metal Edition",
    issuer: "HDFC Bank",
    lastFour: "9012",
    network: "Visa",
    creditLimit: 800000,
    currentSpend: 148500,
    billingDay: 18,
    dueDay: 7,
    color: "#0F172A",
    accentColor: "#F5D084",
    rewardType: "Reward Points (1 RP = ₹1)",
    perks: ["SmartBuy 5X Flights & Hotels (16.5% value)", "Unlimited International Lounge Access", "1:1 Air Miles Transfer"],
    categoryMultipliers: {
      Travel: 16.5,
      Flights: 16.5,
      Dining: 6.6,
      Amazon: 9.9,
      Flipkart: 9.9,
      General: 3.3,
    },
  },
  {
    cardName: "Cashback Credit Card",
    issuer: "State Bank of India",
    lastFour: "4821",
    network: "Visa",
    creditLimit: 250000,
    currentSpend: 38200,
    billingDay: 22,
    dueDay: 12,
    color: "#0284C7",
    accentColor: "#38BDF8",
    rewardType: "5% Online Statement Credit",
    perks: ["5% Flat Cashback on all online merchants", "1% Fuel Surcharge Waiver", "Direct statement credit automatically"],
    categoryMultipliers: {
      Amazon: 5.0,
      Flipkart: 5.0,
      Swiggy: 5.0,
      Zomato: 5.0,
      Shopping: 5.0,
      General: 1.0,
    },
  },
  {
    cardName: "Amazon Pay Card",
    issuer: "ICICI Bank",
    lastFour: "6640",
    network: "Visa",
    creditLimit: 300000,
    currentSpend: 54100,
    billingDay: 10,
    dueDay: 30,
    color: "#1E293B",
    accentColor: "#FF9900",
    rewardType: "Amazon Pay Balance",
    perks: ["Lifetime Free (No annual fees)", "5% on Amazon India", "2% on Bill Payments & Recharges"],
    categoryMultipliers: {
      Amazon: 5.0,
      Utilities: 2.0,
      Recharge: 2.0,
      General: 1.0,
    },
  },
];

exports.getCards = async (req, res) => {
  try {
    const userId = req.user._id;
    let cards = await CreditCard.find({ user: userId }).sort({ creditLimit: -1 });

    if (cards.length === 0) {
      const seeded = DEFAULT_CARDS.map((c) => ({ ...c, user: userId }));
      cards = await CreditCard.insertMany(seeded);
    }

    let totalLimit = 0;
    let totalSpend = 0;
    cards.forEach((c) => {
      totalLimit += c.creditLimit;
      totalSpend += c.currentSpend;
    });

    const utilizationRatio = totalLimit > 0 ? Math.round((totalSpend / totalLimit) * 100) : 0;

    res.json({
      success: true,
      data: {
        cards,
        metrics: {
          totalCards: cards.length,
          totalLimit,
          totalSpend,
          availableCredit: totalLimit - totalSpend,
          utilizationRatio,
          status: utilizationRatio <= 30 ? "EXCELLENT" : utilizationRatio <= 50 ? "MODERATE" : "HIGH",
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCard = async (req, res) => {
  try {
    const { cardName, issuer, lastFour, network, creditLimit, currentSpend, billingDay, dueDay, color, accentColor, rewardType, perks } = req.body;
    if (!cardName || !issuer || !creditLimit) {
      return res.status(400).json({ success: false, message: "Card name, issuer and limit are required" });
    }

    const card = await CreditCard.create({
      user: req.user._id,
      cardName,
      issuer,
      lastFour: lastFour || "1234",
      network: network || "Visa",
      creditLimit: Number(creditLimit),
      currentSpend: Number(currentSpend) || 0,
      billingDay: Number(billingDay) || 15,
      dueDay: Number(dueDay) || 5,
      color: color || "#0F172A",
      accentColor: accentColor || "#F5D084",
      rewardType: rewardType || "Cashback",
      perks: perks || ["Standard Rewards"],
    });

    res.status(201).json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSpend = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentSpend } = req.body;
    const card = await CreditCard.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { currentSpend: Number(currentSpend) },
      { new: true }
    );
    if (!card) return res.status(404).json({ success: false, message: "Card not found" });

    res.json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const { id } = req.params;
    const card = await CreditCard.findOneAndDelete({ _id: id, user: req.user._id });
    if (!card) return res.status(404).json({ success: false, message: "Card not found" });

    res.json({ success: true, message: "Card deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
