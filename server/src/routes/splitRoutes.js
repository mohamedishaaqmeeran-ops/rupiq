const express = require("express");
const router = express.Router();
const {
  getGroups,
  createGroup,
  getGroupDetails,
  addExpense,
  settleShare,
} = require("../controllers/splitController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.route("/groups").get(getGroups).post(createGroup);
router.route("/groups/:id").get(getGroupDetails);
router.route("/groups/:id/expenses").post(addExpense);
router.route("/expenses/:id/settle").post(settleShare);

module.exports = router;
