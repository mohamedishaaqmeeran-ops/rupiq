const Subscription = require("../models/Subscription");

const DEFAULT_SUBSCRIPTIONS = [
  {
    name: "Netflix Premium",
    plan: "4K UHD + 4 Screens",
    amount: 649,
    billingCycle: "MONTHLY",
    category: "Entertainment",
    icon: "film-outline",
    color: "#E50914",
    remindDaysBefore: 3,
  },
  {
    name: "Spotify Premium",
    plan: "Individual",
    amount: 119,
    billingCycle: "MONTHLY",
    category: "Music",
    icon: "musical-notes-outline",
    color: "#1DB954",
    remindDaysBefore: 2,
  },
  {
    name: "Amazon Prime",
    plan: "Annual Member",
    amount: 1499,
    billingCycle: "ANNUAL",
    category: "Entertainment",
    icon: "cart-outline",
    color: "#FF9900",
    remindDaysBefore: 7,
  },
  {
    name: "YouTube Premium",
    plan: "Family Plan",
    amount: 189,
    billingCycle: "MONTHLY",
    category: "Entertainment",
    icon: "play-circle-outline",
    color: "#FF0000",
    remindDaysBefore: 3,
  },
  {
    name: "Apple iCloud+",
    plan: "200 GB Storage",
    amount: 219,
    billingCycle: "MONTHLY",
    category: "Cloud",
    icon: "cloud-outline",
    color: "#007AFF",
    remindDaysBefore: 2,
  },
  {
    name: "Cult.fit Elite",
    plan: "12 Months Gym & Live",
    amount: 14500,
    billingCycle: "ANNUAL",
    category: "Fitness",
    icon: "barbell-outline",
    color: "#FF3366",
    remindDaysBefore: 14,
  },
];

exports.getSubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;
    let list = await Subscription.find({ user: userId }).sort({ nextBillingDate: 1 });

    if (list.length === 0) {
      // Seed initial subscriptions with realistic upcoming renewal dates
      const seeded = DEFAULT_SUBSCRIPTIONS.map((item, index) => {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (index * 4 + 3));
        return {
          ...item,
          user: userId,
          nextBillingDate: nextDate,
          status: "ACTIVE",
        };
      });
      list = await Subscription.insertMany(seeded);
    }

    // Calculate metrics
    let monthlyBurn = 0;
    let annualBurn = 0;
    let activeCount = 0;

    list.forEach((sub) => {
      if (sub.status === "ACTIVE") {
        activeCount++;
        let monthly = sub.amount;
        if (sub.billingCycle === "ANNUAL") {
          monthly = Math.round(sub.amount / 12);
          annualBurn += sub.amount;
        } else if (sub.billingCycle === "QUARTERLY") {
          monthly = Math.round(sub.amount / 3);
          annualBurn += sub.amount * 4;
        } else {
          annualBurn += sub.amount * 12;
        }
        monthlyBurn += monthly;
      }
    });

    res.json({
      success: true,
      data: {
        subscriptions: list,
        metrics: {
          totalSubscriptions: list.length,
          activeCount,
          monthlyBurn,
          annualBurn,
          upcomingRenewalsCount: list.filter((s) => {
            const daysLeft = Math.ceil((new Date(s.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft >= 0 && daysLeft <= 7 && s.status === "ACTIVE";
          }).length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const { name, plan, amount, billingCycle, category, nextBillingDate, color, icon, remindDaysBefore } = req.body;
    if (!name || !amount || !nextBillingDate) {
      return res.status(400).json({ success: false, message: "Name, amount and nextBillingDate are required" });
    }

    const sub = await Subscription.create({
      user: req.user._id,
      name,
      plan: plan || "Standard",
      amount: Number(amount),
      billingCycle: billingCycle || "MONTHLY",
      category: category || "Entertainment",
      nextBillingDate: new Date(nextBillingDate),
      color: color || "#F5D084",
      icon: icon || "repeat-outline",
      remindDaysBefore: remindDaysBefore || 3,
      status: "ACTIVE",
    });

    res.status(201).json({ success: true, data: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await Subscription.findOne({ _id: id, user: req.user._id });
    if (!sub) return res.status(404).json({ success: false, message: "Subscription not found" });

    sub.status = sub.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await sub.save();

    res.json({ success: true, data: sub, message: `Subscription marked as ${sub.status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await Subscription.findOneAndDelete({ _id: id, user: req.user._id });
    if (!sub) return res.status(404).json({ success: false, message: "Subscription not found" });

    res.json({ success: true, message: "Subscription deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
