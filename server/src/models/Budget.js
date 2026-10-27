
const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Month must use YYYY-MM format"],
    },
    limit: {
      type: Number,
      required: true,
      min: [0.01, "Budget must be greater than zero"],
    },
  },
  { timestamps: true }
);

budgetSchema.index(
  { user: 1, category: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("Budget", budgetSchema);
