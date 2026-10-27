
const express = require("express");
const router = express.Router();

const {
  createTransaction,
  getTransactions,
  deleteTransaction,
} = require("../controllers/investmentController");
const {
  getVirtualPortfolio,
} = require("../controllers/virtualPortfolioController");
const {
  getInvestmentSummary,
} = require("../controllers/investmentSummaryController");
const { authenticate } = require("../middleware/auth");

// All investment endpoints require authentication.
router.use(authenticate);

router
  .route("/transactions")
  .get(getTransactions)
  .post(createTransaction);
router.get("/summary", getInvestmentSummary);
router.delete("/transactions/:id", deleteTransaction);
router.get("/portfolio", getVirtualPortfolio);
module.exports = router;
