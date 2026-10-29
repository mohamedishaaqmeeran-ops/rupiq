const mongoose = require("mongoose");

const paisaRoomSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Trip", "Flatmates", "Office", "Family", "Other"],
      default: "Trip",
    },
    color: {
      type: String,
      default: "#F5D084",
    },
    members: [
      {
        name: { type: String, required: true },
        upiId: { type: String, default: "" },
        avatarColor: { type: String, default: "#38BDF8" },
      },
    ],
    expenses: [
      {
        title: { type: String, required: true },
        amount: { type: Number, required: true },
        paidBy: { type: String, required: true },
        splitBetween: [{ type: String }],
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaisaRoom", paisaRoomSchema);
