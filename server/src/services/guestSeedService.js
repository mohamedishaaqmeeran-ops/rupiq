const mongoose = require("mongoose");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const SavingsGoal = require("../models/SavingsGoal");
const Loan = require("../models/Loan");
const LoanRepayment = require("../models/LoanRepayment");
const RecurringTransaction = require("../models/RecurringTransaction");
const VirtualPortfolio = require("../models/VirtualPortfolio");
const InvestmentTransaction = require("../models/InvestmentTransaction");
const Account = require("../models/Account");

async function seedGuestData(userId) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth(); // 0-indexed
  const currentMonthStr = `${currentYear}-${String(currentMonthNum + 1).padStart(2, "0")}`;

  // 1. Categories
  const categoriesData = [
    { name: "Salary", type: "income", icon: "cash", color: "#10B981" },
    { name: "Freelance", type: "income", icon: "laptop", color: "#3B82F6" },
    { name: "Investments", type: "income", icon: "trending-up", color: "#8B5CF6" },
    { name: "Housing", type: "expense", icon: "home", color: "#EF4444" },
    { name: "Groceries", type: "expense", icon: "cart", color: "#F59E0B" },
    { name: "Dining Out", type: "expense", icon: "restaurant", color: "#EC4899" },
    { name: "Utilities", type: "expense", icon: "flash", color: "#6366F1" },
    { name: "Transportation", type: "expense", icon: "car", color: "#14B8A6" },
    { name: "Entertainment", type: "expense", icon: "film", color: "#8B5CF6" },
    { name: "Healthcare", type: "expense", icon: "medkit", color: "#06B6D4" },
  ];

  await Category.insertMany(
    categoriesData.map((cat) => ({ ...cat, user: userId, isDefault: true }))
  );

  // 2. Transactions (Income & Expenses for Current Month)
  const d = (dayOffset) => {
    const date = new Date(now);
    date.setDate(Math.max(1, now.getDate() - dayOffset));
    return date;
  };

  const sampleTransactions = [
    {
      user: userId,
      type: "income",
      amount: 85000,
      category: "Salary",
      description: "Monthly Tech Salary",
      date: d(15),
    },
    {
      user: userId,
      type: "income",
      amount: 18500,
      category: "Freelance",
      description: "UI/UX App Redesign Contract",
      date: d(8),
    },
    {
      user: userId,
      type: "expense",
      amount: 22000,
      category: "Housing",
      description: "Apartment Rent & Maintenance",
      date: d(14),
    },
    {
      user: userId,
      type: "expense",
      amount: 7200,
      category: "Groceries",
      description: "Supermarket & Monthly Organic Staples",
      date: d(12),
    },
    {
      user: userId,
      type: "expense",
      amount: 3850,
      category: "Dining Out",
      description: "Weekend Bistro Dinner with Friends",
      date: d(5),
    },
    {
      user: userId,
      type: "expense",
      amount: 2650,
      category: "Utilities",
      description: "High-speed Fiber & Electricity Bill",
      date: d(9),
    },
    {
      user: userId,
      type: "expense",
      amount: 4200,
      category: "Transportation",
      description: "Fuel & Metro Transit Pass",
      date: d(3),
    },
    {
      user: userId,
      type: "expense",
      amount: 999,
      category: "Entertainment",
      description: "Streaming Bundle Subscription",
      date: d(7),
    },
    {
      user: userId,
      type: "expense",
      amount: 1500,
      category: "Healthcare",
      description: "Multivitamins & Routine Checkup",
      date: d(2),
    },
  ];

  await Transaction.insertMany(sampleTransactions);

  // 3. Budgets
  const sampleBudgets = [
    { user: userId, category: "Groceries", amount: 10000, month: currentMonthStr },
    { user: userId, category: "Dining Out", amount: 6000, month: currentMonthStr },
    { user: userId, category: "Utilities", amount: 3500, month: currentMonthStr },
    { user: userId, category: "Transportation", amount: 6000, month: currentMonthStr },
  ];

  await Budget.insertMany(sampleBudgets);

  // 4. Savings Goals
  const sixMonthsAhead = new Date(now);
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
  const oneYearAhead = new Date(now);
  oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);

  const sampleGoals = [
    {
      user: userId,
      name: "Emergency Fund",
      targetAmount: 200000,
      currentAmount: 135000,
      targetDate: sixMonthsAhead,
    },
    {
      user: userId,
      name: "Electric Vehicle Fund",
      targetAmount: 350000,
      currentAmount: 110000,
      targetDate: oneYearAhead,
    },
  ];

  await SavingsGoal.insertMany(sampleGoals);

  // 5. Loan & Repayment
  const loanStartDate = new Date(now);
  loanStartDate.setMonth(loanStartDate.getMonth() - 10);
  const nextLoanDue = new Date(now);
  nextLoanDue.setDate(now.getDate() + 12);

  const sampleLoan = await Loan.create({
    user: userId,
    lenderName: "HDFC Auto Finance",
    loanType: "vehicle",
    principalAmount: 400000,
    interestRate: 8.75,
    tenureMonths: 36,
    remainingTenureMonths: 26,
    startDate: loanStartDate,
    emiAmount: 12675,
    outstandingAmount: 298400,
    nextDueDate: nextLoanDue,
    status: "active",
    notes: "Car loan EMI auto-debited on the 10th of every month.",
  });

  const repaymentDate1 = new Date(now);
  repaymentDate1.setMonth(repaymentDate1.getMonth() - 1);

  await LoanRepayment.create({
    loan: sampleLoan._id,
    user: userId,
    amountPaid: 12675,
    principalPaid: 10500,
    interestPaid: 2175,
    paymentDate: repaymentDate1,
    remainingPrincipal: 298400,
    notes: "Regular scheduled EMI payment.",
  });

  // 6. Recurring Transactions
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const sampleRecurring = [
    {
      user: userId,
      type: "expense",
      amount: 12675,
      category: "Housing",
      description: "Car Loan EMI",
      frequency: "monthly",
      startDate: loanStartDate,
      nextRunDate: nextLoanDue,
      status: "active",
    },
    {
      user: userId,
      type: "expense",
      amount: 999,
      category: "Entertainment",
      description: "Cloud & Media Subscriptions",
      frequency: "monthly",
      startDate: d(20),
      nextRunDate: nextWeek,
      status: "active",
    },
    {
      user: userId,
      type: "income",
      amount: 85000,
      category: "Salary",
      description: "Direct Deposit Salary",
      frequency: "monthly",
      startDate: d(30),
      nextRunDate: d(-15),
      status: "active",
    },
  ];

  await RecurringTransaction.insertMany(sampleRecurring);

  // 7. Virtual Portfolio & Investments
  await VirtualPortfolio.create({
    user: userId,
    startingCash: 100000,
    availableCash: 31200,
    currency: "INR",
  });

  const sampleInvestments = [
    {
      user: userId,
      portfolioMode: "virtual",
      assetType: "stock",
      symbol: "TCS",
      assetName: "Tata Consultancy Services",
      transactionType: "buy",
      quantity: 5,
      pricePerUnit: 3950,
      fees: 25,
      currency: "INR",
      transactionDate: d(20),
    },
    {
      user: userId,
      portfolioMode: "virtual",
      assetType: "stock",
      symbol: "RELIANCE",
      assetName: "Reliance Industries Ltd",
      transactionType: "buy",
      quantity: 10,
      pricePerUnit: 2450,
      fees: 25,
      currency: "INR",
      transactionDate: d(18),
    },
    {
      user: userId,
      portfolioMode: "virtual",
      assetType: "crypto",
      symbol: "BTC",
      assetName: "Bitcoin",
      transactionType: "buy",
      quantity: 0.002,
      pricePerUnit: 6400000,
      fees: 50,
      currency: "INR",
      transactionDate: d(10),
    },
    {
      user: userId,
      portfolioMode: "virtual",
      assetType: "gold",
      symbol: "GOLD_SGB",
      assetName: "Sovereign Gold Bond 2026",
      transactionType: "buy",
      quantity: 2,
      pricePerUnit: 6100,
      fees: 0,
      currency: "INR",
      transactionDate: d(15),
    },
  ];

  await InvestmentTransaction.insertMany(sampleInvestments);

  // 8. Accounts & Wallets
  const sampleAccounts = [
    {
      user: userId,
      name: "HDFC Salary Account",
      type: "bank",
      institution: "HDFC Bank",
      accountNumber: "•••• 4821",
      balance: 112500,
      currency: "INR",
      color: "#3B82F6",
      isDefault: true,
      notes: "Primary account for salary credit and bill debits.",
    },
    {
      user: userId,
      name: "SBI Emergency Reserve",
      type: "bank",
      institution: "State Bank of India",
      accountNumber: "•••• 9104",
      balance: 45000,
      currency: "INR",
      color: "#10B981",
      isDefault: false,
      notes: "High-interest savings account for emergency fund.",
    },
    {
      user: userId,
      name: "ICICI Amazon Pay Credit Card",
      type: "credit_card",
      institution: "ICICI Bank",
      accountNumber: "•••• 3318",
      balance: 14200,
      creditLimit: 150000,
      currency: "INR",
      color: "#EF4444",
      notes: "5% cashback on Amazon. Due on 20th of every month.",
    },
    {
      user: userId,
      name: "Cash Wallet",
      type: "cash",
      institution: "Physical Cash",
      accountNumber: "",
      balance: 4800,
      currency: "INR",
      color: "#F59E0B",
      notes: "Cash on hand for local groceries and small vendors.",
    },
  ];

  const createdAccounts = await Account.insertMany(sampleAccounts);
  const primaryBank = createdAccounts[0];

  // 10. Sample Realtime Bill Payments (via Bank & UPI)
  const BillPayment = require("../models/BillPayment");
  const sampleBillPayments = [
    {
      user: userId,
      account: primaryBank._id,
      paymentMethod: "upi",
      upiId: "guest@okhdfcbank",
      npciApprovalCode: "NPCI-AUTH-892144",
      billerName: "Netflix India",
      billerCategory: "subscription",
      consumerNumber: "PRESET-PLAN",
      amount: 649,
      status: "success",
      referenceId: "UPI-481923-7412",
      paymentDate: d(2),
      notes: "Paid via Instant UPI",
    },
    {
      user: userId,
      account: primaryBank._id,
      paymentMethod: "bank_account",
      npciApprovalCode: "NPCI-AUTH-109283",
      billerName: "Adani Electricity Mumbai",
      billerCategory: "electricity",
      consumerNumber: "1029384756",
      amount: 2450,
      status: "success",
      referenceId: "BBPS-819203-3190",
      paymentDate: d(7),
      notes: "Paid via Direct Bank API",
    },
  ];
  await BillPayment.insertMany(sampleBillPayments);

  // 11. Sample Realtime Insurance Policies
  const InsurancePolicy = require("../models/InsurancePolicy");
  const expiryNextYear = new Date(now);
  expiryNextYear.setFullYear(now.getFullYear() + 1);

  const samplePolicies = [
    {
      user: userId,
      policyNumber: "POL-HLT-2026-894120",
      category: "health",
      providerName: "HDFC ERGO",
      planName: "Optima Secure 4X Health Plan",
      sumInsured: 1000000,
      premiumAmount: 8450,
      premiumFrequency: "annual",
      paymentMethod: "upi",
      paymentReference: "UPI-INS-891024-9128",
      upiId: "guest@okhdfcbank",
      startDate: d(45),
      expiryDate: expiryNextYear,
      nextRenewalDate: expiryNextYear,
      status: "active",
      insuredPersons: [{ name: "Self (Guest)", relation: "Self", age: 28 }],
      nominee: { name: "Ananya Sharma", relation: "Spouse" },
      cashlessNetworkCount: 13000,
      taxBenefitSection: "Section 80D - Save up to ₹25,000 tax",
      claims: [
        {
          claimNumber: "CLM-892104-582",
          claimType: "cashless",
          amountClaimed: 35000,
          amountApproved: 35000,
          status: "settled",
          hospitalOrGarage: "Apollo Multi-Specialty Hospital, Mumbai",
          incidentDate: d(20),
          settledDate: d(18),
          remarks: "Cashless emergency hospitalization settled via TPA Desk",
        },
      ],
    },
    {
      user: userId,
      policyNumber: "POL-TER-2026-381920",
      category: "term_life",
      providerName: "ICICI Prudential",
      planName: "iProtect Smart Term Protection",
      sumInsured: 10000000, // ₹1 Crore
      premiumAmount: 8640,
      premiumFrequency: "annual",
      paymentMethod: "bank_account",
      paymentReference: "PAY-INS-182903-4912",
      account: primaryBank._id,
      startDate: d(60),
      expiryDate: expiryNextYear,
      nextRenewalDate: expiryNextYear,
      status: "active",
      insuredPersons: [{ name: "Self (Guest)", relation: "Self", age: 28 }],
      nominee: { name: "Ananya Sharma", relation: "Spouse" },
      cashlessNetworkCount: 0,
      taxBenefitSection: "Section 80C - Save up to ₹46,800 tax",
      claims: [],
    },
  ];
  await InsurancePolicy.insertMany(samplePolicies);
}

module.exports = { seedGuestData };
