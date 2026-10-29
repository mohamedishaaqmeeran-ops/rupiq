const express = require("express");
const router = express.Router();
const { getRewards, scratchCard } = require("../controllers/rewardController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", getRewards);
router.post("/scratch", scratchCard);

module.exports = router;
