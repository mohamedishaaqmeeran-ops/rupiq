const express = require("express");
const router = express.Router();
const { generateStatementReport } = require("../controllers/reportController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/statement", generateStatementReport);

module.exports = router;
