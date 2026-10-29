const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getRooms,
  createRoom,
  addExpense,
  deleteRoom,
} = require("../controllers/paisaRoomController");

router.use(authenticate);

router.get("/", getRooms);
router.post("/", createRoom);
router.post("/:id/expenses", addExpense);
router.delete("/:id", deleteRoom);

module.exports = router;
