const express = require("express");
const router = express.Router();
const {
  getRates,
  getVault,
  buyAsset,
  sellAsset,
  configureSip,
} = require("../controllers/goldController");
const { authenticate } = require("../middleware/auth");

router.get("/rates", getRates);

router.use(authenticate);
router.get("/vault", getVault);
router.post("/buy", buyAsset);
router.post("/sell", sellAsset);
router.post("/sip", configureSip);

module.exports = router;
