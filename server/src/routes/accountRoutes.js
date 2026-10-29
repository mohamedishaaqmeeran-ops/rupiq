const express = require("express");
const router = express.Router();
const {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  transferFunds,
  getTransfers,
  linkRealtimeBank,
  syncAccountBalance,
  getLiquidityOverview,
  transferInvestmentToBank,
  transferBankToInvestment,
  getBillerCatalog,
  payBillOrSubscription,
  getBillPaymentHistory,
  payViaUpi,
} = require("../controllers/accountController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.route("/").get(getAccounts).post(createAccount);
router.post("/link-bank", linkRealtimeBank);
router.post("/:id/sync-balance", syncAccountBalance);
router.get("/liquidity-overview", getLiquidityOverview);
router.post("/investment-to-bank", transferInvestmentToBank);
router.post("/bank-to-investment", transferBankToInvestment);
router.get("/biller-catalog", getBillerCatalog);
router.post("/pay-bill", payBillOrSubscription);
router.get("/bill-payments", getBillPaymentHistory);
router.post("/upi-pay", payViaUpi);
router.post("/transfer", transferFunds);

router.get("/transfers", getTransfers);
router.route("/:id").put(updateAccount).delete(deleteAccount);

module.exports = router;
