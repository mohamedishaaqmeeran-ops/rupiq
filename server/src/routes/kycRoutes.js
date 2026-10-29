const express  = require("express");
const router   = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const {
  getMyKyc,
  updateMyKyc,
  submitKyc,
  listPendingKyc,
  reviewKyc,
} = require("../controllers/kycController");

// User routes (authenticated)
router.use(authenticate);
router.get("/me",         getMyKyc);
router.patch("/me",       updateMyKyc);
router.post("/me/submit", submitKyc);

// Admin routes
router.get("/pending",      authorize("admin", "super_admin"), listPendingKyc);
router.patch("/:id/review", authorize("admin", "super_admin"), reviewKyc);

module.exports = router;
