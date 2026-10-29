const UserReward = require("../models/UserReward");
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");

const ALL_BADGES = [
  {
    badgeId: "lakhpati",
    name: "Lakhpati Club",
    category: "Wealth",
    icon: "diamond-outline",
    description: "Achieved over ₹1,00,000 in net portfolio worth.",
  },
  {
    badgeId: "gold_stacker",
    name: "24K Gold Stacker",
    category: "Investments",
    icon: "trophy-outline",
    description: "Safeguarded wealth in certified digital gold.",
  },
  {
    badgeId: "budget_master",
    name: "Disciplined Aviator",
    category: "Budgeting",
    icon: "shield-checkmark-outline",
    description: "Maintained a 5-day active streak under budget.",
  },
  {
    badgeId: "upi_fast",
    name: "Lightning Payer",
    category: "Payments",
    icon: "flash-outline",
    description: "Completed instant UPI QR payments.",
  },
  {
    badgeId: "tax_optimizer",
    name: "Tax Strategist",
    category: "Tax",
    icon: "calculator-outline",
    description: "Optimized income tax across Old and New regimes.",
  },
  {
    badgeId: "split_pro",
    name: "Fair Share Pro",
    category: "Social",
    icon: "people-outline",
    description: "Split bills seamlessly without leaving debt behind.",
  },
];

// GET /api/rewards
exports.getRewards = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    let rewards = await UserReward.findOne({ user: userId });
    if (!rewards) {
      rewards = await UserReward.create({
        user: userId,
        currentStreakDays: 5,
        longestStreakDays: 12,
        prestigePoints: 680,
        tier: "Silver Aviator",
        unlockedBadges: [
          { badgeId: "budget_master", name: "Disciplined Aviator", icon: "shield-checkmark-outline", category: "Budgeting" },
          { badgeId: "upi_fast", name: "Lightning Payer", icon: "flash-outline", category: "Payments" },
        ],
        scratchcards: [
          { id: "sc_1", rewardText: "₹45 Gold Cashback Bonus", coins: 45, isScratched: false },
          { id: "sc_2", rewardText: "100 Prestige Points", coins: 100, isScratched: true },
        ],
      });
    }

    res.status(200).json({
      success: true,
      rewards,
      allAvailableBadges: ALL_BADGES,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/rewards/scratch
exports.scratchCard = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { cardId } = req.body;

    const rewards = await UserReward.findOne({ user: userId });
    if (!rewards) {
      return res.status(404).json({ success: false, message: "Rewards profile not found." });
    }

    const card = rewards.scratchcards.find((c) => c.id === cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: "Scratchcard not found." });
    }

    if (!card.isScratched) {
      card.isScratched = true;
      rewards.prestigePoints += card.coins || 50;
      await rewards.save();
    }

    res.status(200).json({
      success: true,
      message: `Congratulations! Unlocked: ${card.rewardText}`,
      card,
      newTotalPoints: rewards.prestigePoints,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
