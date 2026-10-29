const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getInsuranceCatalog,
  calculateInstantQuote,
  buyInsurancePolicy,
  getUserPolicies,
  renewPolicy,
  fileClaim,
  getUserClaims,
  simulateClaimStep,
} = require("../controllers/insuranceController");

// Public or semi-public
router.get("/catalog", getInsuranceCatalog);
router.post("/calculate-quote", calculateInstantQuote);

// Protected routes (requires user login)
router.use(authenticate);
router.post("/buy-policy", buyInsurancePolicy);
router.get("/my-policies", getUserPolicies);
router.post("/renew-policy", renewPolicy);
router.post("/file-claim", fileClaim);
router.get("/claims", getUserClaims);
router.post("/simulate-claim-step", simulateClaimStep);

module.exports = router;
