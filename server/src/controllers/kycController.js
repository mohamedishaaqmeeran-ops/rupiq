const KYC = require("../models/KYC");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate how complete a KYC record is (0–100%).
 * Used to guide the user through the multi-step form.
 */
function calcCompletionPercent(kyc) {
  const checks = [
    // Personal
    !!kyc.fullName,
    !!kyc.dateOfBirth,
    !!kyc.gender,
    !!kyc.phone,
    !!kyc.address?.line1,
    !!kyc.address?.city,
    !!kyc.address?.state,
    !!kyc.address?.pincode,
    // PAN
    !!kyc.pan?.number,
    !!kyc.pan?.documentUrl,
    // Aadhaar
    !!kyc.aadhaar?.maskedNumber,
    !!kyc.aadhaar?.documentUrl,
    // Bank
    !!kyc.bankAccount?.accountNumber,
    !!kyc.bankAccount?.ifscCode,
    !!kyc.bankAccount?.cancelledChequeUrl,
    // Occupation
    !!kyc.occupation,
    !!kyc.annualIncome,
    !!kyc.sourceOfFunds,
    // Risk profile
    !!kyc.riskProfile?.category,
    // FATCA
    kyc.fatca?.declarationAccepted === true,
    // Nominee
    !!kyc.nominee?.name,
    !!kyc.nominee?.relationship,
    // Consents
    kyc.consents?.termsAccepted === true,
    kyc.consents?.pmlaDeclaration === true,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

// ─── GET /api/kyc/me ──────────────────────────────────────────────────────────
exports.getMyKyc = async (req, res, next) => {
  try {
    let kyc = await KYC.findOne({ user: req.user.id });

    if (!kyc) {
      // Auto-create empty KYC record on first access
      kyc = await KYC.create({ user: req.user.id });
    }

    res.json({ success: true, kyc });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/kyc/me ────────────────────────────────────────────────────────
/**
 * Partial update — each step of the multi-step form sends only its fields.
 * Sensitive fields (pan.number, aadhaar.maskedNumber) are masked in the response.
 */
exports.updateMyKyc = async (req, res, next) => {
  try {
    // Prevent users from self-approving
    delete req.body.status;
    delete req.body.approvedAt;
    delete req.body.reviewedBy;

    // Validate PAN format if being set (AAAAA9999A)
    if (req.body.pan?.number) {
      const pan = req.body.pan.number.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
        return res.status(400).json({
          success: false,
          message: "Invalid PAN format. Expected format: AAAAA9999A",
        });
      }
      req.body.pan.number = pan;
    }

    // Store only masked Aadhaar (XXXX XXXX last4) — never store full Aadhaar
    if (req.body.aadhaar?.fullNumber) {
      const full = req.body.aadhaar.fullNumber.replace(/\D/g, "");
      if (full.length !== 12) {
        return res.status(400).json({
          success: false,
          message: "Invalid Aadhaar number. Must be 12 digits.",
        });
      }
      req.body.aadhaar.maskedNumber = `XXXX XXXX ${full.slice(8)}`;
      delete req.body.aadhaar.fullNumber;  // Never persist full number
    }

    // Validate IFSC format if provided
    if (req.body.bankAccount?.ifscCode) {
      const ifsc = req.body.bankAccount.ifscCode.trim().toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        return res.status(400).json({
          success: false,
          message: "Invalid IFSC code format. Expected: AAAA0XXXXXX",
        });
      }
      req.body.bankAccount.ifscCode = ifsc;
    }

    // Validate FATCA consent date
    if (req.body.fatca?.declarationAccepted === true) {
      req.body.fatca.declarationDate = new Date();
    }

    if (req.body.consents?.termsAccepted === true) {
      req.body.consents.termsAcceptedAt = new Date();
    }

    const kyc = await KYC.findOneAndUpdate(
      { user: req.user.id },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );

    // Recalculate and persist completion %
    const pct = calcCompletionPercent(kyc);
    kyc.completionPercent = pct;
    await kyc.save();

    res.json({
      success: true,
      message: "KYC information saved",
      completionPercent: pct,
      kyc,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─── POST /api/kyc/me/submit ──────────────────────────────────────────────────
/**
 * User submits KYC for review after completing all steps.
 * Requires minimum 80% completion.
 */
exports.submitKyc = async (req, res, next) => {
  try {
    const kyc = await KYC.findOne({ user: req.user.id });

    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC not started" });
    }

    if (["submitted", "approved"].includes(kyc.status)) {
      return res.status(400).json({
        success: false,
        message: `KYC is already ${kyc.status}`,
      });
    }

    const pct = calcCompletionPercent(kyc);
    if (pct < 80) {
      return res.status(400).json({
        success: false,
        message: `KYC is only ${pct}% complete. Minimum 80% required to submit.`,
        completionPercent: pct,
      });
    }

    // Mandatory fields check
    const missing = [];
    if (!kyc.pan?.number)               missing.push("PAN number");
    if (!kyc.aadhaar?.maskedNumber)     missing.push("Aadhaar");
    if (!kyc.bankAccount?.accountNumber) missing.push("Bank account number");
    if (!kyc.bankAccount?.ifscCode)     missing.push("IFSC code");
    if (!kyc.consents?.termsAccepted)   missing.push("Terms acceptance");
    if (!kyc.consents?.pmlaDeclaration) missing.push("PMLA declaration");
    if (!kyc.fatca?.declarationAccepted) missing.push("FATCA declaration");

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing mandatory fields: ${missing.join(", ")}`,
      });
    }

    kyc.status = "submitted";
    kyc.submittedAt = new Date();
    kyc.ipAddress = req.ip;
    kyc.userAgent = req.get("user-agent");
    await kyc.save();

    res.json({
      success: true,
      message: "KYC submitted successfully. Review typically takes 1-2 business days.",
      kyc,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Admin: GET /api/kyc/pending ──────────────────────────────────────────────
exports.listPendingKyc = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page ?? "1", 10));
    const limit = Math.min(50, parseInt(req.query.limit ?? "20", 10));
    const status = req.query.status ?? "submitted";

    const [records, total] = await Promise.all([
      KYC.find({ status })
        .populate("user", "name email createdAt")
        .sort({ submittedAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      KYC.countDocuments({ status }),
    ]);

    res.json({
      success: true,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      records,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Admin: PATCH /api/kyc/:id/review ────────────────────────────────────────
exports.reviewKyc = async (req, res, next) => {
  try {
    const { action, reason } = req.body; // action: "approve" | "reject"

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'" });
    }

    if (action === "reject" && !reason) {
      return res.status(400).json({ success: false, message: "Rejection reason is required" });
    }

    const update =
      action === "approve"
        ? { status: "approved", approvedAt: new Date(), reviewedBy: req.user.id, rejectionReason: "" }
        : { status: "rejected", rejectionReason: reason, reviewedBy: req.user.id };

    const kyc = await KYC.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("user", "name email");

    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC record not found" });
    }

    res.json({
      success: true,
      message: `KYC ${action === "approve" ? "approved" : "rejected"}`,
      kyc,
    });
  } catch (err) {
    next(err);
  }
};
