const mongoose = require("mongoose");

const userRewardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    currentStreakDays: {
      type: Number,
      default: 3,
    },
    longestStreakDays: {
      type: Number,
      default: 7,
    },
    prestigePoints: {
      type: Number,
      default: 450,
    },
    tier: {
      type: String,
      enum: ["Bronze Pilot", "Silver Aviator", "Gold Commander", "Diamond Prestige"],
      default: "Silver Aviator",
    },
    unlockedBadges: [
      {
        badgeId: String,
        name: String,
        icon: String,
        category: String,
        unlockedAt: { type: Date, default: Date.now },
      },
    ],
    scratchcards: [
      {
        id: String,
        rewardText: String,
        coins: Number,
        isScratched: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserReward", userRewardSchema);
