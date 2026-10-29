
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    importHash: {
      type: String,
      default: undefined,
    },
        recurringOccurrenceKey: {
      type: String,
      default: undefined,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent importing the same transaction more than once for a user.
// Transactions created manually can have no importHash.
transactionSchema.index(
      { recurringOccurrenceKey: 1 },
  { user: 1, importHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      importHash: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
