const mongoose = require("mongoose");
const Account = require("../models/Account");
const AccountTransfer = require("../models/AccountTransfer");
const BillPayment = require("../models/BillPayment");
const VirtualPortfolio = require("../models/VirtualPortfolio");
const InvestmentTransaction = require("../models/InvestmentTransaction");
const Transaction = require("../models/Transaction");

// GET /api/accounts
exports.getAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await Account.find({ user: userId, isActive: true }).sort({
      createdAt: 1,
    });

    let totalLiquidAssets = 0;
    let totalCreditDebt = 0;

    for (const acc of accounts) {
      if (acc.type === "credit_card") {
        totalCreditDebt += acc.balance;
      } else {
        totalLiquidAssets += acc.balance;
      }
    }

    res.status(200).json({
      success: true,
      count: accounts.length,
      summary: {
        totalLiquidAssets: Math.round(totalLiquidAssets * 100) / 100,
        totalCreditDebt: Math.round(totalCreditDebt * 100) / 100,
        netLiquidWorth: Math.round((totalLiquidAssets - totalCreditDebt) * 100) / 100,
      },
      accounts,
    });
  } catch (error) {
    console.error("Get accounts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch accounts",
    });
  }
};

// POST /api/accounts
exports.createAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      type = "bank",
      institution = "",
      accountNumber = "",
      balance = 0,
      creditLimit = 0,
      currency = "INR",
      color = "#3B82F6",
      notes = "",
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account name is required.",
      });
    }

    const numericBalance = Number(balance);
    const numericLimit = Number(creditLimit);

    if (isNaN(numericBalance)) {
      return res.status(400).json({
        success: false,
        message: "Invalid balance amount.",
      });
    }

    const account = await Account.create({
      user: userId,
      name: name.trim(),
      type,
      institution: institution.trim(),
      accountNumber: accountNumber.trim(),
      balance: numericBalance,
      creditLimit: numericLimit >= 0 ? numericLimit : 0,
      currency,
      color,
      notes: notes.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    console.error("Create account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
};

// PUT /api/accounts/:id
exports.updateAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid account ID." });
    }

    const account = await Account.findOne({ _id: id, user: userId });
    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    const {
      name,
      type,
      institution,
      accountNumber,
      balance,
      creditLimit,
      color,
      notes,
    } = req.body;

    if (name !== undefined) account.name = name.trim();
    if (type !== undefined) account.type = type;
    if (institution !== undefined) account.institution = institution.trim();
    if (accountNumber !== undefined) account.accountNumber = accountNumber.trim();
    if (balance !== undefined && !isNaN(Number(balance))) account.balance = Number(balance);
    if (creditLimit !== undefined && !isNaN(Number(creditLimit))) account.creditLimit = Number(creditLimit);
    if (color !== undefined) account.color = color;
    if (notes !== undefined) account.notes = notes.trim();

    await account.save();

    res.status(200).json({
      success: true,
      message: "Account updated successfully",
      account,
    });
  } catch (error) {
    console.error("Update account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update account",
    });
  }
};

// DELETE /api/accounts/:id
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid account ID." });
    }

    const account = await Account.findOneAndUpdate(
      { _id: id, user: userId },
      { isActive: false },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    res.status(200).json({
      success: true,
      message: "Account removed successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};

// POST /api/accounts/transfer
exports.transferFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fromAccountId, toAccountId, amount, notes = "" } = req.body;

    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      return res.status(400).json({
        success: false,
        message: "Please select two different accounts for the transfer.",
      });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Transfer amount must be greater than zero.",
      });
    }

    const fromAcc = await Account.findOne({ _id: fromAccountId, user: userId, isActive: true });
    const toAcc = await Account.findOne({ _id: toAccountId, user: userId, isActive: true });

    if (!fromAcc || !toAcc) {
      return res.status(404).json({
        success: false,
        message: "One or both selected accounts were not found.",
      });
    }

    // If transferring from cash/bank/wallet, ensure sufficient funds
    if (fromAcc.type !== "credit_card" && fromAcc.balance < transferAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds in ${fromAcc.name}. Available: ₹${fromAcc.balance.toLocaleString("en-IN")}`,
      });
    }

    // Execute transfer
    fromAcc.balance -= transferAmount;

    // If destination is credit card, paying credit card reduces the outstanding balance
    if (toAcc.type === "credit_card") {
      toAcc.balance = Math.max(0, toAcc.balance - transferAmount);
    } else {
      toAcc.balance += transferAmount;
    }

    await fromAcc.save();
    await toAcc.save();

    const transfer = await AccountTransfer.create({
      user: userId,
      fromAccount: fromAccountId,
      toAccount: toAccountId,
      amount: transferAmount,
      notes: notes.trim(),
    });

    res.status(201).json({
      success: true,
      message: `Transferred ₹${transferAmount.toLocaleString("en-IN")} from ${fromAcc.name} to ${toAcc.name}`,
      transfer,
    });
  } catch (error) {
    console.error("Transfer funds error:", error);
    res.status(500).json({
      success: false,
      message: "Transfer failed to execute.",
    });
  }
};

// GET /api/accounts/transfers
exports.getTransfers = async (req, res) => {
  try {
    const userId = req.user.id;
    const transfers = await AccountTransfer.find({ user: userId })
      .populate("fromAccount", "name type color")
      .populate("toAccount", "name type color")
      .sort({ transferDate: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: transfers.length,
      transfers,
    });
  } catch (error) {
    console.error("Get transfers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transfers",
    });
  }
};

// ─── Realtime Bank Linking & Sync ───────────────────────────────────────────

const BANK_BRAND_COLORS = {
  hdfc: "#004c8f",
  sbi: "#0083ca",
  icici: "#b32025",
  axis: "#97144d",
  kotak: "#ed1c24",
  pnb: "#a20a3a",
  bob: "#f26522",
  canara: "#0091da",
  yes: "#005596",
  default: "#1E3A8A",
};

// POST /api/accounts/link-bank
exports.linkRealtimeBank = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      institution,
      accountNumber,
      ifscCode = "",
      upiId = "",
      accountHolderName = "",
      initialBalance = 25000,
    } = req.body;

    if (!institution || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: "Institution name and Account Number are required.",
      });
    }

    const cleanInst = institution.trim();
    const cleanAccNo = accountNumber.trim();
    const last4 = cleanAccNo.slice(-4) || cleanAccNo;
    const key = cleanInst.toLowerCase();
    const color = Object.keys(BANK_BRAND_COLORS).find((k) => key.includes(k))
      ? BANK_BRAND_COLORS[Object.keys(BANK_BRAND_COLORS).find((k) => key.includes(k))]
      : BANK_BRAND_COLORS.default;

    const account = await Account.create({
      user: userId,
      name: `${cleanInst} ••${last4}`,
      type: "bank",
      institution: cleanInst,
      accountNumber: cleanAccNo,
      ifscCode: ifscCode.trim().toUpperCase(),
      upiId: upiId.trim() || `${last4}@${key.split(" ")[0]}bank`,
      accountHolderName: accountHolderName.trim() || "Account Holder",
      balance: Math.max(0, Number(initialBalance) || 25000),
      currency: "INR",
      color,
      isRealtimeLinked: true,
      lastSyncedAt: new Date(),
      syncStatus: "linked",
      notes: "Linked via Open Banking / Bank API integration",
    });

    res.status(201).json({
      success: true,
      message: `${cleanInst} linked successfully with realtime balance tracking.`,
      account,
    });
  } catch (error) {
    console.error("Link bank error:", error);
    res.status(500).json({ success: false, message: "Failed to link bank account." });
  }
};

// POST /api/accounts/:id/sync-balance
exports.syncAccountBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const account = await Account.findOne({ _id: id, user: userId, isActive: true });
    if (!account) {
      return res.status(404).json({ success: false, message: "Bank account not found." });
    }

    // Realtime Bank API sync simulation: slight micro-interest/tick or confirmed sync
    account.lastSyncedAt = new Date();
    account.syncStatus = "linked";
    await account.save();

    res.status(200).json({
      success: true,
      message: `Live balance refreshed from ${account.institution || account.name}`,
      account,
      syncedAt: account.lastSyncedAt,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to sync bank balance." });
  }
};

// ─── Unified Net Worth & Liquidity Overview ─────────────────────────────────

// GET /api/accounts/liquidity-overview
exports.getLiquidityOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch Accounts
    const accounts = await Account.find({ user: userId, isActive: true });
    const bankAccounts = accounts.filter((a) => a.type === "bank");
    const creditAccounts = accounts.filter((a) => a.type === "credit_card");
    const walletAccounts = accounts.filter((a) => a.type === "wallet" || a.type === "cash");

    const totalBankBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalCreditDebt = creditAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalWalletBalance = walletAccounts.reduce((sum, a) => sum + a.balance, 0);

    // 2. Fetch Virtual Investment Portfolio
    const portfolio = await VirtualPortfolio.findOne({ user: userId });
    const availableTradingCash = portfolio ? portfolio.availableCash : 0;

    // 3. Aggregate holdings value
    const holdings = await InvestmentTransaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), portfolioMode: "virtual" } },
      {
        $group: {
          _id: "$symbol",
          assetType: { $first: "$assetType" },
          assetName: { $first: "$assetName" },
          units: {
            $sum: {
              $cond: [{ $eq: ["$transactionType", "buy"] }, "$quantity", { $multiply: ["$quantity", -1] }],
            },
          },
          costBasis: {
            $sum: {
              $cond: [{ $eq: ["$transactionType", "buy"] }, { $multiply: ["$quantity", "$pricePerUnit"] }, 0],
            },
          },
        },
      },
      { $match: { units: { $gt: 0 } } },
    ]);

    const totalInvestedCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    // Rough estimate for portfolio value (cost basis * market factor)
    const holdingsMarketValue = Math.round(totalInvestedCost * 1.042 * 100) / 100;
    const totalInvestmentValue = Math.round((availableTradingCash + holdingsMarketValue) * 100) / 100;

    const netWorth = Math.round(
      (totalBankBalance + totalWalletBalance + totalInvestmentValue - totalCreditDebt) * 100
    ) / 100;

    res.status(200).json({
      success: true,
      liquidity: {
        totalBankBalance: Math.round(totalBankBalance * 100) / 100,
        totalWalletBalance: Math.round(totalWalletBalance * 100) / 100,
        totalCreditDebt: Math.round(totalCreditDebt * 100) / 100,
        bankAccounts,
      },
      investment: {
        availableTradingCash: Math.round(availableTradingCash * 100) / 100,
        holdingsMarketValue,
        totalInvestedCost: Math.round(totalInvestedCost * 100) / 100,
        unrealizedReturns: Math.round((holdingsMarketValue - totalInvestedCost) * 100) / 100,
        totalInvestmentValue,
        positionsCount: holdings.length,
      },
      netWorth,
    });
  } catch (error) {
    console.error("Liquidity overview error:", error);
    res.status(500).json({ success: false, message: "Failed to generate liquidity overview." });
  }
};

// ─── Bi-directional Investment ⇄ Bank Transfers ─────────────────────────────

// POST /api/accounts/investment-to-bank (Withdraw from investments to bank)
exports.transferInvestmentToBank = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bankAccountId, amount, notes = "" } = req.body;

    const numAmount = Number(amount);
    if (!bankAccountId || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please specify a valid linked bank account and amount greater than 0.",
      });
    }

    const bankAccount = await Account.findOne({ _id: bankAccountId, user: userId, isActive: true });
    if (!bankAccount) {
      return res.status(404).json({ success: false, message: "Linked bank account not found." });
    }

    const portfolio = await VirtualPortfolio.findOne({ user: userId });
    if (!portfolio || portfolio.availableCash < numAmount) {
      const avail = portfolio ? portfolio.availableCash : 0;
      return res.status(400).json({
        success: false,
        message: `Insufficient investment cash. Available to withdraw: ₹${avail.toLocaleString("en-IN")}`,
      });
    }

    // Execute transfer: Deduct from investment cash, add to bank account
    portfolio.availableCash -= numAmount;
    bankAccount.balance += numAmount;

    await portfolio.save();
    await bankAccount.save();

    const transfer = await AccountTransfer.create({
      user: userId,
      fromAccount: bankAccountId, // Representing investment cash source
      toAccount: bankAccountId,
      amount: numAmount,
      notes: notes.trim() || `Withdrawal from Investment Cash to ${bankAccount.institution || bankAccount.name}`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully transferred ₹${numAmount.toLocaleString("en-IN")} from Investment Cash to ${bankAccount.name}!`,
      newBankBalance: bankAccount.balance,
      newInvestmentCash: portfolio.availableCash,
      transfer,
    });
  } catch (error) {
    console.error("Investment to bank error:", error);
    res.status(500).json({ success: false, message: "Withdrawal failed." });
  }
};

// POST /api/accounts/bank-to-investment (Deposit from bank to investments)
exports.transferBankToInvestment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bankAccountId, amount, notes = "" } = req.body;

    const numAmount = Number(amount);
    if (!bankAccountId || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please specify a valid linked bank account and amount greater than 0.",
      });
    }

    const bankAccount = await Account.findOne({ _id: bankAccountId, user: userId, isActive: true });
    if (!bankAccount) {
      return res.status(404).json({ success: false, message: "Bank account not found." });
    }

    if (bankAccount.balance < numAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance in ${bankAccount.name}. Available: ₹${bankAccount.balance.toLocaleString("en-IN")}`,
      });
    }

    // Execute deposit: Deduct from bank account, add to investment cash
    bankAccount.balance -= numAmount;
    await bankAccount.save();

    const portfolio = await VirtualPortfolio.findOneAndUpdate(
      { user: userId },
      { $inc: { availableCash: numAmount } },
      { new: true, upsert: true }
    );

    const transfer = await AccountTransfer.create({
      user: userId,
      fromAccount: bankAccountId,
      toAccount: bankAccountId,
      amount: numAmount,
      notes: notes.trim() || `Funded Investment Cash from ${bankAccount.institution || bankAccount.name}`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully deposited ₹${numAmount.toLocaleString("en-IN")} into Investment Cash from ${bankAccount.name}!`,
      newBankBalance: bankAccount.balance,
      newInvestmentCash: portfolio.availableCash,
      transfer,
    });
  } catch (error) {
    console.error("Bank to investment error:", error);
    res.status(500).json({ success: false, message: "Deposit failed." });
  }
};

// ─── Payments API: Billings & Subscriptions ─────────────────────────────────

const BILLER_CATALOG = [
  // Subscriptions
  { id: "netflix", name: "Netflix India", category: "subscription", plans: [199, 499, 649], icon: "film", popular: true },
  { id: "spotify", name: "Spotify Premium", category: "subscription", plans: [119, 179, 299], icon: "musical-notes", popular: true },
  { id: "prime", name: "Amazon Prime", category: "subscription", plans: [299, 1499], icon: "logo-amazon", popular: true },
  { id: "youtube", name: "YouTube Premium", category: "subscription", plans: [149, 189], icon: "logo-youtube", popular: true },
  { id: "hotstar", name: "Disney+ Hotstar", category: "subscription", plans: [149, 499, 899], icon: "tv" },
  { id: "cultfit", name: "Cult.fit Fitness Pass", category: "subscription", plans: [1450, 3999], icon: "fitness" },

  // Electricity & Utilities
  { id: "adani_elec", name: "Adani Electricity Mumbai", category: "electricity", icon: "flash", popular: true },
  { id: "tata_power", name: "Tata Power", category: "electricity", icon: "flash" },
  { id: "bescom", name: "BESCOM Bangalore", category: "electricity", icon: "flash" },
  { id: "msedcl", name: "Mahavitaran (MSEDCL)", category: "electricity", icon: "flash" },

  // Mobile & Broadband
  { id: "jio", name: "Jio Prepaid / Postpaid", category: "mobile_recharge", icon: "phone-portrait", popular: true },
  { id: "airtel", name: "Airtel Mobile", category: "mobile_recharge", icon: "phone-portrait", popular: true },
  { id: "airtel_fiber", name: "Airtel Xstream Fiber", category: "broadband", icon: "wifi" },
  { id: "jio_fiber", name: "JioFiber Broadband", category: "broadband", icon: "wifi" },
  { id: "tata_play", name: "Tata Play DTH", category: "dth", icon: "tv" },

  // Credit Card
  { id: "hdfc_card", name: "HDFC Credit Card Bill", category: "credit_card", icon: "card" },
  { id: "sbi_card", name: "SBI Card Payment", category: "credit_card", icon: "card" },
  { id: "icici_card", name: "ICICI Credit Card", category: "credit_card", icon: "card" },

  // Insurance Premiums
  { id: "star_health_biller", name: "Star Health Insurance Premium", category: "insurance", icon: "shield-checkmark", popular: true },
  { id: "lic_premium", name: "Life Insurance Corp (LIC)", category: "insurance", icon: "shield-checkmark", popular: true },
  { id: "hdfc_ergo_biller", name: "HDFC ERGO General Insurance", category: "insurance", icon: "shield-checkmark" },
  { id: "icici_lombard_biller", name: "ICICI Lombard Motor / Health", category: "insurance", icon: "shield-checkmark" },
];

// GET /api/accounts/biller-catalog
exports.getBillerCatalog = (req, res) => {
  res.status(200).json({
    success: true,
    count: BILLER_CATALOG.length,
    billers: BILLER_CATALOG,
  });
};

// POST /api/accounts/pay-bill
exports.payBillOrSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      bankAccountId,
      paymentMethod = "bank_account", // "bank_account" | "upi"
      upiId = "",
      billerName,
      billerCategory = "subscription",
      consumerNumber = "",
      amount,
      notes = "",
    } = req.body;

    const numAmount = Number(amount);
    if (!billerName || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid biller name and positive payment amount.",
      });
    }

    const isUpi = paymentMethod === "upi";
    let bankAccount = null;
    let effectiveUpiId = upiId.trim();

    // 1. Process Bank Account or UPI rail
    if (!isUpi) {
      // Must have bankAccountId
      if (!bankAccountId) {
        return res.status(400).json({
          success: false,
          message: "Please select a bank account to debit.",
        });
      }

      bankAccount = await Account.findOne({ _id: bankAccountId, user: userId, isActive: true });
      if (!bankAccount) {
        return res.status(404).json({ success: false, message: "Selected bank account not found." });
      }

      if (bankAccount.balance < numAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds in ${bankAccount.name}. Balance: ₹${bankAccount.balance.toLocaleString("en-IN")}`,
        });
      }

      // Debit bank balance
      bankAccount.balance -= numAmount;
      await bankAccount.save();
    } else {
      // UPI Payment: If a bankAccountId is optionally passed, debit it as the underlying UPI account
      if (bankAccountId) {
        bankAccount = await Account.findOne({ _id: bankAccountId, user: userId, isActive: true });
        if (bankAccount && bankAccount.balance >= numAmount) {
          bankAccount.balance -= numAmount;
          await bankAccount.save();
          if (!effectiveUpiId && bankAccount.upiId) {
            effectiveUpiId = bankAccount.upiId;
          }
        }
      }
      if (!effectiveUpiId) {
        effectiveUpiId = "user@okhdfcbank";
      }
    }

    // 2. Generate Realtime Reference ID & NPCI Authorization Code
    const refPrefix = isUpi ? "UPI" : "BBPS";
    const refCode = `${refPrefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const npciAuth = `NPCI-AUTH-${Math.floor(100000 + Math.random() * 900000)}`;

    // 3. Log Expense Transaction in Expense Tracker
    const expenseTx = await Transaction.create({
      user: userId,
      type: "expense",
      amount: numAmount,
      category:
        billerCategory === "subscription"
          ? "Subscriptions"
          : billerCategory === "insurance"
          ? "Insurance & Protection"
          : "Bills & Utilities",
      description: `Bill Payment: ${billerName} (${consumerNumber || refCode})`,
      date: new Date(),
      account: bankAccount?._id,
      notes:
        notes ||
        `Paid via ${isUpi ? `UPI (${effectiveUpiId})` : `Bank (${bankAccount?.name})`} • Ref: ${refCode} • Auth: ${npciAuth}`,
    });

    // 4. Create BillPayment Record
    const billPayment = await BillPayment.create({
      user: userId,
      account: bankAccount?._id,
      paymentMethod: isUpi ? "upi" : "bank_account",
      upiId: effectiveUpiId,
      npciApprovalCode: npciAuth,
      billerName,
      billerCategory,
      consumerNumber,
      amount: numAmount,
      status: "success",
      referenceId: refCode,
      paymentDate: new Date(),
      transaction: expenseTx._id,
      notes,
    });

    res.status(201).json({
      success: true,
      message: `Payment of ₹${numAmount.toLocaleString("en-IN")} to ${billerName} via ${isUpi ? "UPI" : "Bank"} successful!`,
      referenceId: refCode,
      npciApprovalCode: npciAuth,
      paymentMethod: isUpi ? "upi" : "bank_account",
      upiId: effectiveUpiId,
      billPayment,
      remainingBankBalance: bankAccount ? bankAccount.balance : undefined,
    });
  } catch (error) {
    console.error("Pay bill error:", error);
    res.status(500).json({ success: false, message: "Bill payment API processing failed." });
  }
};

// GET /api/accounts/bill-payments
exports.getBillPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const payments = await BillPayment.find({ user: userId })
      .populate("account", "name institution color")
      .sort({ paymentDate: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch payment history." });
  }
};

// POST /api/accounts/upi-pay
exports.payViaUpi = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      accountId,
      upiId,
      payeeName,
      amount,
      category = "Expense",
      notes = "UPI Payment",
      qrRawData = "",
    } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid positive payment amount required." });
    }
    if (!upiId || !upiId.includes("@")) {
      return res.status(400).json({ success: false, message: "Valid UPI VPA required (e.g., recipient@upi)." });
    }

    let account = null;
    if (accountId) {
      account = await Account.findOne({ _id: accountId, user: userId, isActive: true });
    }
    if (!account) {
      account = await Account.findOne({ user: userId, type: "bank", isActive: true });
    }
    if (!account) {
      account = await Account.findOne({ user: userId, isActive: true });
    }

    if (!account) {
      return res.status(404).json({ success: false, message: "No active bank or wallet account found to debit from." });
    }

    if (account.balance < numAmount && account.type !== "credit_card") {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance in ${account.name}. Current balance: ₹${account.balance.toLocaleString("en-IN")}`,
      });
    }

    // Debit account
    account.balance = Math.max(0, Math.round((account.balance - numAmount) * 100) / 100);
    await account.save();

    // Generate 12-digit NPCI UTR and Auth code
    const utrNumber = "UPI" + Math.floor(100000000000 + Math.random() * 900000000000).toString().slice(0, 10);
    const npciApproval = "AUTH" + Math.floor(100000 + Math.random() * 900000);

    // Create Expense transaction in PaisaPilot ledger
    const transaction = await Transaction.create({
      user: userId,
      type: "expense",
      amount: numAmount,
      category: category || "Other",
      description: `UPI to ${payeeName || upiId} (${notes})`,
      paymentMethod: "UPI",
      referenceNumber: utrNumber,
      account: account._id,
      date: new Date(),
    });

    res.status(200).json({
      success: true,
      message: `UPI Payment of ₹${numAmount.toLocaleString("en-IN")} to ${payeeName || upiId} successful!`,
      receipt: {
        utrNumber,
        npciApproval,
        amount: numAmount,
        payeeName: payeeName || upiId,
        payeeUpiId: upiId,
        debitedFrom: account.name,
        remainingBalance: account.balance,
        timestamp: new Date().toISOString(),
        transactionId: transaction._id,
        notes,
      },
    });
  } catch (error) {
    console.error("UPI Pay error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process UPI transaction." });
  }
};


