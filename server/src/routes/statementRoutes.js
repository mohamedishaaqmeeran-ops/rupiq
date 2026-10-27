const express = require("express");
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const { importCsvStatement } = require("../controllers/statementController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

router.post(
  "/csv",
  authenticate,
  upload.single("statement"),
  importCsvStatement
);

module.exports = router;