const express = require("express");
const router = express.Router();
const { getCreditScore, simulateScore } = require("../controllers/creditController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/score", getCreditScore);
router.post("/simulate", simulateScore);

module.exports = router;
