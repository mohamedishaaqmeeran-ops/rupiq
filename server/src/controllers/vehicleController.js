const VehicleLog = require("../models/VehicleLog");

const DEFAULT_VEHICLES = [
  {
    vehicleName: "Hyundai Creta 1.5 SX",
    vehicleType: "Car",
    fuelType: "Petrol",
    regNumber: "MH 02 EK 7712",
    odometerCurrent: 32400,
    costPerKm: 7.2,
    fastagBalance: 1250,
    insuranceExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    pucExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    fuelLogs: [
      {
        litres: 34.5,
        ratePerLitre: 104.2,
        totalCost: 3594,
        odometer: 32400,
        fuelStation: "Shell Fuel Bandra",
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        litres: 38.0,
        ratePerLitre: 103.8,
        totalCost: 3944,
        odometer: 31920,
        fuelStation: "IndianOil Expressway",
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        litres: 30.0,
        ratePerLitre: 104.0,
        totalCost: 3120,
        odometer: 31480,
        fuelStation: "Bharat Petroleum",
        date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
    ],
  },
];

exports.getVehicles = async (req, res) => {
  try {
    const userId = req.user._id;
    let vehicles = await VehicleLog.find({ user: userId }).sort({ updatedAt: -1 });

    if (vehicles.length === 0) {
      const seeded = DEFAULT_VEHICLES.map((v) => ({ ...v, user: userId }));
      vehicles = await VehicleLog.insertMany(seeded);
    }

    const computed = vehicles.map((v) => {
      const logs = v.fuelLogs || [];
      const totalFuelSpent = logs.reduce((sum, l) => sum + l.totalCost, 0);
      const totalLitres = logs.reduce((sum, l) => sum + l.litres, 0);

      // Estimate mileage between first and last logged odo
      let avgMileage = 14.5;
      if (logs.length >= 2) {
        const sorted = [...logs].sort((a, b) => b.odometer - a.odometer);
        const distance = sorted[0].odometer - sorted[sorted.length - 1].odometer;
        const litresUsed = sorted.slice(0, sorted.length - 1).reduce((s, l) => s + l.litres, 0);
        if (litresUsed > 0 && distance > 0) {
          avgMileage = parseFloat((distance / litresUsed).toFixed(1));
        }
      }

      const daysToInsurance = Math.ceil((new Date(v.insuranceExpiry) - new Date()) / (1000 * 60 * 60 * 24));
      const daysToPuc = Math.ceil((new Date(v.pucExpiry) - new Date()) / (1000 * 60 * 60 * 24));

      return {
        ...v.toObject(),
        totalFuelSpent,
        totalLitres: Math.round(totalLitres),
        avgMileage,
        daysToInsurance: daysToInsurance > 0 ? daysToInsurance : 0,
        daysToPuc: daysToPuc > 0 ? daysToPuc : 0,
      };
    });

    res.json({ success: true, data: computed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addFuelLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { litres, ratePerLitre, odometer, fuelStation } = req.body;
    if (!litres || !ratePerLitre || !odometer) {
      return res.status(400).json({ success: false, message: "Litres, rate, and odometer are required" });
    }

    const totalCost = Math.round(Number(litres) * Number(ratePerLitre));
    const vehicle = await VehicleLog.findOne({ _id: id, user: req.user._id });
    if (!vehicle) return res.status(404).json({ success: false, message: "Vehicle not found" });

    vehicle.fuelLogs.unshift({
      litres: Number(litres),
      ratePerLitre: Number(ratePerLitre),
      totalCost,
      odometer: Number(odometer),
      fuelStation: fuelStation || "Fuel Station",
      date: new Date(),
    });

    if (Number(odometer) > vehicle.odometerCurrent) {
      vehicle.odometerCurrent = Number(odometer);
    }

    await vehicle.save();
    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createVehicle = async (req, res) => {
  try {
    const { vehicleName, vehicleType, fuelType, regNumber, odometerCurrent } = req.body;
    if (!vehicleName) return res.status(400).json({ success: false, message: "Vehicle name required" });

    const vehicle = await VehicleLog.create({
      user: req.user._id,
      vehicleName,
      vehicleType: vehicleType || "Car",
      fuelType: fuelType || "Petrol",
      regNumber: regNumber || "MH 01 AB 1234",
      odometerCurrent: Number(odometerCurrent) || 10000,
      fuelLogs: [],
    });

    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
