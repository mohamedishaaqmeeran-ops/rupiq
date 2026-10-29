const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getSubscriptions,
  createSubscription,
  toggleStatus,
  deleteSubscription,
} = require("../controllers/subscriptionController");

router.use(authenticate);

router.get("/", getSubscriptions);
router.post("/", createSubscription);
router.patch("/:id/toggle", toggleStatus);
router.delete("/:id", deleteSubscription);

module.exports = router;
