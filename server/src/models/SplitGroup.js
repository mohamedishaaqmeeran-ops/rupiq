const mongoose = require("mongoose");

const splitMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: "",
  },
  phone: {
    type: String,
    trim: true,
    default: "",
  },
  isUser: {
    type: Boolean,
    default: false,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

const splitGroupSchema = new mongoose.Schema(
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
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: ["Trip", "Home", "Dining", "Office", "Project", "Other"],
      default: "Other",
    },
    avatar: {
      type: String,
      default: "people-outline",
    },
    members: [splitMemberSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SplitGroup", splitGroupSchema);
