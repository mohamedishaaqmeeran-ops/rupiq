
const express = require("express");
const router = express.Router();

const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
} = require("../controllers/categoryController");

const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", getCategories);
router.post("/", createCategory);
router.post("/seed-defaults", seedDefaultCategories);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
