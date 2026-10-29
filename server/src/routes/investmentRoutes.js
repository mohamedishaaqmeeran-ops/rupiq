
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
const {
  getMarketQuotes,
  getQuoteBySymbol,
  getQuoteHistory,
  resetPortfolio,
} = require("../controllers/marketQuoteController");
const {
  getMutualFunds,
  getUserSips,
  createSip,
  updateSipStatus,
} = require("../controllers/mutualFundController");
const { authenticate } = require("../middleware/auth");

// All investment endpoints require authentication.
router.use(authenticate);

router
  .route("/transactions")
  .get(getTransactions)
  .post(createTransaction);
router.get("/summary", getInvestmentSummary);
router.get("/quotes", getMarketQuotes);
router.get("/quotes/:symbol", getQuoteBySymbol);
router.get("/quotes/:symbol/history", getQuoteHistory);
router.get("/mutual-funds", getMutualFunds);
router.get("/sip", getUserSips);
router.post("/sip", createSip);
router.patch("/sip/:id", updateSipStatus);
router.post("/portfolio/reset", resetPortfolio);
router.delete("/transactions/:id", deleteTransaction);
router.get("/portfolio", getVirtualPortfolio);
module.exports = router;
