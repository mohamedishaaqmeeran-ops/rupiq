const mongoose = require("mongoose");

const vehicleLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleName: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      enum: ["Car", "Bike", "EV Car", "EV Scooter"],
      default: "Car",
    },
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG", "Electric"],
      default: "Petrol",
    },
    regNumber: {
      type: String,
      default: "MH 02 CZ 4821",
    },
    odometerCurrent: {
      type: Number,
      default: 28450,
    },
    costPerKm: {
      type: Number,
      default: 6.8,
    },
    fastagBalance: {
      type: Number,
      default: 850,
    },
    insuranceExpiry: {
      type: Date,
      default: () => new Date(Date.now() + 140 * 24 * 60 * 60 * 1000),
    },
    pucExpiry: {
      type: Date,
      default: () => new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    },
    fuelLogs: [
      {
        litres: { type: Number, required: true },
        ratePerLitre: { type: Number, required: true },
        totalCost: { type: Number, required: true },
        odometer: { type: Number, required: true },
        fuelStation: { type: String, default: "Shell" },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("VehicleLog", vehicleLogSchema);
