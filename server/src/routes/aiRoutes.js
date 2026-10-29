const express = require("express");
const router = express.Router();
const {
  chatWithAdvisor,
  getFinancialAudit,
  getFinancialSnapshot,
  getSaverToInvestorPlan,
  executeSaverPlan,
} = require("../controllers/aiController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.post("/chat", chatWithAdvisor);
router.get("/audit", getFinancialAudit);
router.get("/snapshot", getFinancialSnapshot);
router.get("/saver-to-investor", getSaverToInvestorPlan);
router.post("/saver-to-investor/execute", executeSaverPlan);

module.exports = router;
