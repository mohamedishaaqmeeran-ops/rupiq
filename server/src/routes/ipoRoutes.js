const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { getIpos } = require("../controllers/ipoController");

router.use(authenticate);

router.get("/", getIpos);

module.exports = router;
