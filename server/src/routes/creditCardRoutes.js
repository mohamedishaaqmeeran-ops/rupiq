const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getCards,
  createCard,
  updateSpend,
  deleteCard,
} = require("../controllers/creditCardController");

router.use(authenticate);

router.get("/", getCards);
router.post("/", createCard);
router.patch("/:id/spend", updateSpend);
router.delete("/:id", deleteCard);

module.exports = router;
