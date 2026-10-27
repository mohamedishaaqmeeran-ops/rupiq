require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const statementRoutes = require("./routes/statementRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const savingsGoalRoutes = require("./routes/savingsGoalRoutes");

const recurringTransactionRoutes = require("./routes/recurringTransactionRoutes");
const {
  startRecurringTransactionScheduler,
} = require("./services/recurringTransactionScheduler");

const app = express();

app.disable("x-powered-by");
app.use(helmet());

// Configure allowed origins explicitly for production.
app.use(cors());

app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
  })
);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "PaisaPilot API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/statements", statementRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/goals", savingsGoalRoutes);
app.use("/api/investments", require("./routes/investmentRoutes"));
app.use(
  "/api/recurring-transactions",
  recurringTransactionRoutes
);



app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error("API error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be configured securely");
  }

  await connectDB();

  startRecurringTransactionScheduler();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PaisaPilot API running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});

