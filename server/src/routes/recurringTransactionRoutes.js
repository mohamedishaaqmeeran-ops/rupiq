
const express = require("express");
const { authenticate } = require("../middleware/auth");

const {
  createRecurringTransaction,
  getRecurringTransactions,
  updateRecurringTransaction,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  cancelRecurringTransaction,
} = require("../controllers/recurringTransactionController");

const router = express.Router();

router.use(authenticate);

router.get("/", getRecurringTransactions);
router.post("/", createRecurringTransaction);
router.patch("/:id", updateRecurringTransaction);
router.patch("/:id/pause", pauseRecurringTransaction);
router.patch("/:id/resume", resumeRecurringTransaction);
router.patch("/:id/cancel", cancelRecurringTransaction);

module.exports = router;
