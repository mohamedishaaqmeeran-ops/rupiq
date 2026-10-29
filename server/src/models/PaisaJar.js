const mongoose = require("mongoose");

const paisaJarSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    roundUpTo: {
      type: Number,
      enum: [10, 50, 100],
      default: 10,
    },
    currentJarBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeJarSaved: {
      type: Number,
      default: 0,
      min: 0,
    },
    autoInvestTarget: {
      type: String,
      enum: ["GOLD", "LIQUID_FUND", "NONE"],
      default: "GOLD",
    },
    autoInvestThreshold: {
      type: Number,
      default: 100, // auto invests when Jar hits ₹100
    },
    lastInvestedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaisaJar", paisaJarSchema);
