const express = require("express");
const router = express.Router();
const {
  getNotifications,
  createNotification,
  markAsRead,
} = require("../controllers/notificationController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.route("/").get(getNotifications).post(createNotification);
router.route("/:id/read").put(markAsRead);

module.exports = router;
