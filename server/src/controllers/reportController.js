const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const Loan = require("../models/Loan");
const SIP = require("../models/SIP");
const VirtualPortfolio = require("../models/VirtualPortfolio");

// GET /api/reports/statement?month=2026-10&format=json|csv|html
exports.generateStatementReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { month, format = "json" } = req.query;

    const query = { user: userId };
    if (month) {
      const [year, m] = month.split("-").map(Number);
      query.date = {
        $gte: new Date(year, m - 1, 1),
        $lte: new Date(year, m, 0, 23, 59, 59),
      };
    }

    const [transactions, accounts, loans, sips, portfolio] = await Promise.all([
      Transaction.find(query).sort({ date: -1 }),
      Account.find({ user: userId, isActive: true }),
      Loan.find({ user: userId }),
      SIP.find({ user: userId }),
      VirtualPortfolio.findOne({ user: userId }),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = {};

    transactions.forEach((tx) => {
      if (tx.type === "income") {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      }
    });

    const netSavings = totalIncome - totalExpense;
    const totalLiquidAssets = accounts.reduce((sum, a) => sum + (a.type !== "credit_card" ? a.balance : 0), 0);
    const totalCreditDebt = accounts.reduce((sum, a) => sum + (a.type === "credit_card" ? a.balance : 0), 0);
    const totalLoanDebt = loans.reduce((sum, l) => sum + (l.remainingBalance || 0), 0);
    const portfolioValue = portfolio ? portfolio.totalInvested || 0 : 0;
    const netWorth = totalLiquidAssets + portfolioValue - totalCreditDebt - totalLoanDebt;

    if (format === "csv") {
      let csv = "Date,Type,Category,Description,Amount (INR),Payment Method\n";
      transactions.forEach((tx) => {
        const d = new Date(tx.date).toLocaleDateString("en-IN");
        const desc = `"${(tx.description || "").replace(/"/g, '""')}"`;
        csv += `${d},${tx.type},${tx.category},${desc},${tx.amount},${tx.paymentMethod || "N/A"}\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="PaisaPilot_Report_${month || "All"}.csv"`);
      return res.status(200).send(csv);
    }

    if (format === "html") {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PaisaPilot Financial Statement - ${month || "Complete"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B1528; color: #F8FAFC; margin: 0; padding: 30px; }
    .header { border-bottom: 2px solid #3B82F6; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 26px; font-weight: 800; color: #F59E0B; }
    .meta { font-size: 13px; color: #94A3B8; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0; }
    .card { background: #13254A; padding: 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); }
    .card-label { font-size: 11px; text-transform: uppercase; color: #94A3B8; }
    .card-val { font-size: 20px; font-weight: 800; margin-top: 6px; }
    .green { color: #10B981; } .red { color: #EF4444; } .blue { color: #60A5FA; } .gold { color: #F59E0B; }
    table { width: 100%; border-collapse: collapse; margin-top: 25px; background: #101F3D; border-radius: 10px; overflow: hidden; }
    th { background: #1E3A8A; color: #BFDBFE; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; }
    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
    .footer { margin-top: 40px; text-align: center; color: #64748B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">PAISAPILOT</div>
      <div class="meta">Certified Financial Ledger &bull; Generated for ${req.user.name || "Client"} (${req.user.email || ""})</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700; color: #E2E8F0;">Period: ${month || "Complete History"}</div>
      <div class="meta">Date: ${new Date().toLocaleDateString("en-IN")}</div>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Total Income</div>
      <div class="card-val green">₹${totalIncome.toLocaleString("en-IN")}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Expenses</div>
      <div class="card-val red">₹${totalExpense.toLocaleString("en-IN")}</div>
    </div>
    <div class="card">
      <div class="card-label">Net Savings</div>
      <div class="card-val blue">₹${netSavings.toLocaleString("en-IN")}</div>
    </div>
    <div class="card">
      <div class="card-label">Estimated Net Worth</div>
      <div class="card-val gold">₹${netWorth.toLocaleString("en-IN")}</div>
    </div>
  </div>

  <h3 style="color: #93C5FD; margin-top: 30px;">Transaction Breakdown (${transactions.length} items)</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th>Category</th>
        <th>Method</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${transactions
        .map(
          (t) => `
        <tr>
          <td>${new Date(t.date).toLocaleDateString("en-IN")}</td>
          <td>${t.description || "-"}</td>
          <td>${t.category}</td>
          <td>${t.paymentMethod || "UPI/Bank"}</td>
          <td style="text-align: right; font-weight: 700;" class="${t.type === "income" ? "green" : "red"}">
            ${t.type === "income" ? "+" : "-"}₹${t.amount.toLocaleString("en-IN")}
          </td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    PaisaPilot AI &bull; Encrypted Personal Financial Statement &bull; Confidential
  </div>
</body>
</html>
      `;
      return res.status(200).send(html);
    }

    res.status(200).json({
      success: true,
      summary: {
        totalIncome,
        totalExpense,
        netSavings,
        totalLiquidAssets,
        totalCreditDebt,
        totalLoanDebt,
        portfolioValue,
        netWorth,
      },
      categoryTotals,
      transactionsCount: transactions.length,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
