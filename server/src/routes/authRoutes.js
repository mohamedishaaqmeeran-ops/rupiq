const express = require("express");
const {
  register,
  login,
  me,
  guest,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/guest", guest);
router.get("/me", authenticate, me);

module.exports = router;