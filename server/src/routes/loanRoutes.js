
const express = require("express");
const router = express.Router();

const {
  getLoans,
  createLoan,
  getLoanById,
  updateLoan,
  deleteLoan,
  getLoanSummary,
} = require("../controllers/loanController");
const {
  createRepayment,
  getRepayments,
} = require("../controllers/loanRepaymentController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router
  .route("/:id/repayments")
  .get(getRepayments)
  .post(createRepayment);
router.get("/summary", getLoanSummary);
router.route("/").get(getLoans).post(createLoan);
router
  .route("/:id")
  .get(getLoanById)
  .put(updateLoan)
  .delete(deleteLoan);

module.exports = router;
