
const express = require("express");
const { authenticate } = require("../middleware/auth");

const {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget,
} = require("../controllers/budgetController");

const router = express.Router();

router.use(authenticate);

router.get("/", getBudgets);
router.post("/", createOrUpdateBudget);
router.delete("/:id", deleteBudget);

module.exports = router;
