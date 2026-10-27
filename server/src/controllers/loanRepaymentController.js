const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const LoanRepayment = require("../models/LoanRepayment");

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const getMonthlyEMI = (principal, annualRate, months) => {
  if (principal <= 0 || months <= 0) return 0;

  const monthlyRate = annualRate / 1200;

  if (monthlyRate === 0) {
    return roundMoney(principal / months);
  }

  const factor = Math.pow(1 + monthlyRate, months);

  return roundMoney((principal * monthlyRate * factor) / (factor - 1));
};

const getRemainingMonths = (principal, annualRate, emi) => {
  if (principal <= 0) return 0;
  if (emi <= 0) return null;

  const monthlyRate = annualRate / 1200;

  if (monthlyRate === 0) {
    return Math.ceil(principal / emi);
  }

  if (emi <= principal * monthlyRate) {
    return null;
  }

  const months =
    -Math.log(1 - (principal * monthlyRate) / emi) / Math.log(1 + monthlyRate);

  return Math.max(1, Math.ceil(months));
};

const monthsBetween = (start, end) => {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();

  let total = years * 12 + months;

  if (end.getDate() < start.getDate()) {
    total -= 1;
  }

  return Math.max(0, total);
};

const createRepayment = async (req, res) => {
  const { amount, paymentDate, referenceNumber, notes } = req.body;
  const { id: loanId } = req.params;

  const prepaymentStrategy = req.body.prepaymentStrategy || "reduce_tenure";

  if (!mongoose.Types.ObjectId.isValid(loanId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid loan ID.",
    });
  }

  if (!["reduce_tenure", "reduce_emi"].includes(prepaymentStrategy)) {
    return res.status(400).json({
      success: false,
      message: "Invalid prepayment strategy.",
    });
  }

  const paymentAmount = Number(amount);
  const paidAt = paymentDate ? new Date(paymentDate) : new Date();

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Repayment amount must be greater than zero.",
    });
  }

  if (Number.isNaN(paidAt.getTime()) || paidAt > new Date()) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment date.",
    });
  }

  const session = await mongoose.startSession();

  try {
    let createdRepayment;

    await session.withTransaction(async () => {
      const loan = await Loan.findOne({
        _id: loanId,
        user: req.user.id,
      }).session(session);

      if (!loan) {
        const error = new Error("Loan not found.");
        error.statusCode = 404;
        throw error;
      }

      if (loan.status !== "active") {
        const error = new Error("This loan is already completed.");
        error.statusCode = 400;
        throw error;
      }

      const previousRepayment = await LoanRepayment.findOne({
        loan: loan._id,
        user: req.user.id,
      })
        .sort({ paymentDate: -1, createdAt: -1 })
        .session(session);

      const accrualStart = previousRepayment
        ? new Date(previousRepayment.paymentDate)
        : new Date(loan.startDate);

      if (paidAt < accrualStart) {
        const error = new Error(
          "Payment date cannot precede the previous repayment or loan start date.",
        );
        error.statusCode = 400;
        throw error;
      }

      const outstanding = roundMoney(loan.outstandingAmount);
      const existingAccruedInterest = roundMoney(loan.accruedInterest || 0);

      // Accrue interest for each complete monthly period since the
      // last payment. This is an estimate, not a lender statement.
      const elapsedMonths = monthsBetween(accrualStart, paidAt);
      const monthlyRate = loan.interestRate / 1200;

      const newlyAccruedInterest = roundMoney(
        outstanding * (Math.pow(1 + monthlyRate, elapsedMonths) - 1),
      );

      const totalInterestDue = roundMoney(
        existingAccruedInterest + newlyAccruedInterest,
      );

      const maximumPayable = roundMoney(outstanding + totalInterestDue);

      if (paymentAmount > maximumPayable) {
        const error = new Error(
          `Payment exceeds the principal and accrued interest balance of ${maximumPayable.toFixed(2)}.`,
        );
        error.statusCode = 400;
        throw error;
      }

      const interestPaid = roundMoney(
        Math.min(paymentAmount, totalInterestDue),
      );

      const principalPaid = roundMoney(paymentAmount - interestPaid);

      const remainingPrincipal = roundMoney(
        Math.max(0, outstanding - principalPaid),
      );

      const remainingInterest = roundMoney(
        Math.max(0, totalInterestDue - interestPaid),
      );

      // Remaining tenure is derived from the original tenure and
      // elapsed time. A dedicated remainingTenureMonths field will
      // be added to the Loan model in the next step.
      const elapsedFromStart = monthsBetween(new Date(loan.startDate), paidAt);

      const remainingMonths = Math.max(
        1,
        (loan.remainingTenureMonths ?? loan.tenureMonths) - elapsedFromStart,
      );

      let updatedEMI = loan.emiAmount;
      let estimatedRemainingMonths = remainingMonths;

      if (remainingPrincipal > 0) {
        if (prepaymentStrategy === "reduce_emi") {
          updatedEMI = getMonthlyEMI(
            remainingPrincipal,
            loan.interestRate,
            remainingMonths,
          );
        } else {
          estimatedRemainingMonths = getRemainingMonths(
            remainingPrincipal,
            loan.interestRate,
            loan.emiAmount,
          );

          if (estimatedRemainingMonths === null) {
            const error = new Error(
              "The current EMI is insufficient to amortize this balance. Recalculate the EMI before continuing.",
            );
            error.statusCode = 400;
            throw error;
          }
        }
      }

      const repayment = new LoanRepayment({
        user: req.user.id,
        loan: loan._id,
        amount: paymentAmount,
        principalPaid,
        interestPaid,
        paymentDate: paidAt,
        referenceNumber: referenceNumber || "",
        notes: notes || "",
        prepaymentStrategy,
      });

      await repayment.save({ session });

      loan.outstandingAmount = remainingPrincipal;
      loan.accruedInterest = remainingInterest;
      loan.emiAmount = updatedEMI;

      loan.remainingTenureMonths =
        remainingPrincipal === 0 && remainingInterest === 0
          ? 0
          : estimatedRemainingMonths;

      if (remainingPrincipal === 0 && remainingInterest === 0) {
        loan.outstandingAmount = 0;
        loan.accruedInterest = 0;
        loan.status = "completed";
      }

      await loan.save({ session });
      createdRepayment = repayment;

      createdRepayment = {
        ...createdRepayment.toObject(),
        estimatedRemainingMonths,
        remainingPrincipal,
        remainingAccruedInterest: remainingInterest,
        updatedEMI,
        prepaymentStrategy,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Repayment recorded successfully.",
      repayment: createdRepayment,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create repayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to record repayment.",
    });
  } finally {
    await session.endSession();
  }
};

const getRepayments = async (req, res) => {
  const { id: loanId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(loanId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid loan ID.",
    });
  }

  try {
    const loan = await Loan.findOne({
      _id: loanId,
      user: req.user.id,
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found.",
      });
    }

    const repayments = await LoanRepayment.find({
      loan: loan._id,
      user: req.user.id,
    }).sort({ paymentDate: -1, createdAt: -1 });

    const totals = repayments.reduce(
      (acc, repayment) => {
        acc.totalRepaid += repayment.amount || 0;
        acc.totalPrincipalPaid += repayment.principalPaid || 0;
        acc.totalInterestPaid += repayment.interestPaid || 0;
        return acc;
      },
      {
        totalRepaid: 0,
        totalPrincipalPaid: 0,
        totalInterestPaid: 0,
      },
    );

    return res.status(200).json({
      success: true,
      count: repayments.length,
      totalRepaid: roundMoney(totals.totalRepaid),
      totalPrincipalPaid: roundMoney(totals.totalPrincipalPaid),
      totalInterestPaid: roundMoney(totals.totalInterestPaid),
      repayments,
    });
  } catch (error) {
    console.error("Get repayments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch repayment history.",
    });
  }
};

module.exports = {
  createRepayment,
  getRepayments,
};
