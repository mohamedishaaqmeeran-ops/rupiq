const express = require("express");
const router = express.Router();
const { getTaxProfile, calculateTax } = require("../controllers/taxController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/profile", getTaxProfile);
router.post("/calculate", calculateTax);

module.exports = router;
