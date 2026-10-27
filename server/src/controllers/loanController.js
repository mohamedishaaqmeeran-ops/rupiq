
const mongoose = require("mongoose");
const Loan = require("../models/Loan");


const calculateEMI = (principal, annualRate, tenureMonths) => {
  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(tenureMonths) ||
    principal <= 0 ||
    annualRate < 0 ||
    annualRate > 100 ||
    !Number.isInteger(tenureMonths) ||
    tenureMonths < 1
  ) {
    throw new Error("Invalid loan calculation inputs.");
  }

  // For a zero-interest loan, divide principal equally by tenure.
  if (annualRate === 0) {
    return Math.round((principal / tenureMonths) * 100) / 100;
  }

  const monthlyRate = annualRate / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);

  const emi =
    (principal * monthlyRate * factor) / (factor - 1);

  return Math.round(emi * 100) / 100;
};


// GET /api/loans
exports.getLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: loans.length,
      loans,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch loans",
    });
  }
};

// POST /api/loans
exports.createLoan = async (req, res) => {
  try {
    const {
      lenderName,
      loanType,
      principalAmount,
      interestRate,
      tenureMonths,
      startDate,
      emiAmount,
      outstandingAmount,
      nextDueDate,
      notes,
    } = req.body;

    if (
      !lenderName ||
      !Number.isFinite(Number(principalAmount)) ||
      Number(principalAmount) <= 0 ||
      !Number.isFinite(Number(interestRate)) ||
      Number(interestRate) < 0 ||
      Number(interestRate) > 100 ||
      !Number.isInteger(Number(tenureMonths)) ||
      Number(tenureMonths) < 1 ||
      !startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid loan details",
      });
    }

    const principal = Number(principalAmount);
    const rate = Number(interestRate);
    const tenure = Number(tenureMonths);

    const calculatedEMI = calculateEMI(principal, rate, tenure);

    const loan = await Loan.create({
      user: req.user.id,
      lenderName,
      loanType,
      principalAmount: principal,
interestRate: rate,
tenureMonths: tenure,
remainingTenureMonths: tenure,
startDate,
      emiAmount:
        emiAmount === undefined || emiAmount === ""
          ? calculatedEMI
          : Number(emiAmount),
      outstandingAmount:
        outstandingAmount === undefined || outstandingAmount === ""
          ? principal
          : Number(outstandingAmount),
      nextDueDate: nextDueDate || null,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Loan created successfully",
      loan,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create loan",
    });
  }
};

// GET /api/loans/:id
exports.getLoanById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan ID",
      });
    }

    const loan = await Loan.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    res.status(200).json({ success: true, loan });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch loan",
    });
  }
};

// PUT /api/loans/:id
exports.updateLoan = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan ID",
      });
    }

    const allowedFields = [
      "lenderName",
      "loanType",
      "principalAmount",
      "interestRate",
      "tenureMonths",
      "startDate",
      "emiAmount",
      "outstandingAmount",
      "nextDueDate",
      "status",
      "notes",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Loan updated successfully",
      loan,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update loan",
    });
  }
};

// DELETE /api/loans/:id
exports.deleteLoan = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan ID",
      });
    }

    const loan = await Loan.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Loan deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete loan",
    });
  }
};

// GET /api/loans/summary
exports.getLoanSummary = async (req, res) => {
  try {
    const loans = await Loan.find({
      user: req.user.id,
      status: "active",
    }).select("principalAmount outstandingAmount emiAmount");

    const summary = loans.reduce(
      (result, loan) => {
        result.totalPrincipal += loan.principalAmount;
        result.totalOutstanding += loan.outstandingAmount;
        result.monthlyEMI += loan.emiAmount;
        return result;
      },
      {
        totalPrincipal: 0,
        totalOutstanding: 0,
        monthlyEMI: 0,
        activeLoans: loans.length,
      }
    );

    res.status(200).json({
      success: true,
      summary: {
        ...summary,
        totalPrincipal: Number(summary.totalPrincipal.toFixed(2)),
        totalOutstanding: Number(summary.totalOutstanding.toFixed(2)),
        monthlyEMI: Number(summary.monthlyEMI.toFixed(2)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to calculate loan summary",
    });
  }
};
