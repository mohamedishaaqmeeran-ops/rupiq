const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getVehicles,
  addFuelLog,
  createVehicle,
} = require("../controllers/vehicleController");

router.use(authenticate);

router.get("/", getVehicles);
router.post("/", createVehicle);
router.post("/:id/fuel", addFuelLog);

module.exports = router;
