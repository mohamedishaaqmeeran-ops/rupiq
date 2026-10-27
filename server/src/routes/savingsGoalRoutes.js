
const express = require("express");
const { authenticate } = require("../middleware/auth");

const {
  getGoals,
  createGoal,
  updateGoal,
  addContribution,
  deleteGoal,
} = require("../controllers/savingsGoalController");

const router = express.Router();

router.use(authenticate);

router.get("/", getGoals);
router.post("/", createGoal);
router.patch("/:id", updateGoal);
router.post("/:id/contributions", addContribution);
router.delete("/:id", deleteGoal);

module.exports = router;
