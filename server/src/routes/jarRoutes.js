const express = require("express");
const router = express.Router();
const {
  getJarStatus,
  updateConfig,
  investJarBalance,
} = require("../controllers/jarController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", getJarStatus);
router.post("/config", updateConfig);
router.post("/invest", investJarBalance);

module.exports = router;
