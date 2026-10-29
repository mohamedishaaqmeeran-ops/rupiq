const mongoose = require("mongoose");

const splitShareSchema = new mongoose.Schema({
  memberName: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  settled: {
    type: Boolean,
    default: false,
  },
  settledAt: {
    type: Date,
  },
});

const splitExpenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SplitGroup",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidBy: {
      type: String,
      required: true,
      trim: true,
    },
    splitType: {
      type: String,
      enum: ["equal", "exact", "percentage"],
      default: "equal",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    category: {
      type: String,
      default: "General",
    },
    shares: [splitShareSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SplitExpense", splitExpenseSchema);
