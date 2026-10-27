const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },

    icon: {
      type: String,
      default: "wallet",
    },

    color: {
      type: String,
      default: "#64748b",
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Prevent duplicate category names for the same user and type.
categorySchema.index(
  { user: 1, name: 1, type: 1 },
  { unique: true }
);

module.exports = mongoose.model("Category", categorySchema);