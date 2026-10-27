
const express = require("express");
const { authenticate } = require("../middleware/auth");

const {
  createTransaction,
  getTransactions,
  getTransactionSummary,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");

const router = express.Router();

router.use(authenticate);

router.get("/summary", getTransactionSummary);
router.get("/", getTransactions);
router.post("/", createTransaction);
router.patch("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

module.exports = router;
