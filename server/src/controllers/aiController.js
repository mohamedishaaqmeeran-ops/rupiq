const {
  getUserFinancialContext,
  callGemini,
  generateFullAudit,
  generateSaverToInvestorPlan,
  executeSaverPlan,
} = require("../services/aiAdvisorService");

// POST /api/ai/chat
exports.chatWithAdvisor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message prompt is required.",
      });
    }

    const context = await getUserFinancialContext(userId);
    const reply = await callGemini(message.trim(), context, history);

    return res.status(200).json({
      success: true,
      reply,
      snapshot: {
        savingsRate: context.savingsRate,
        dtiRatio: context.dtiRatio,
        availableCash: context.availableTradingCash,
      },
    });
  } catch (error) {
    console.error("AI Advisor error:", error);
    return res.status(500).json({
      success: false,
      message: "AI Advisor is temporarily unavailable.",
    });
  }
};

// GET /api/ai/audit
exports.getFinancialAudit = async (req, res) => {
  try {
    const userId = req.user.id;
    const audit = await generateFullAudit(userId);

    return res.status(200).json({
      success: true,
      audit,
    });
  } catch (error) {
    console.error("Financial audit error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate financial audit.",
    });
  }
};

// GET /api/ai/snapshot
exports.getFinancialSnapshot = async (req, res) => {
  try {
    const userId = req.user.id;
    const context = await getUserFinancialContext(userId);

    return res.status(200).json({
      success: true,
      context,
    });
  } catch (error) {
    console.error("Financial snapshot error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load financial context.",
    });
  }
};

// GET /api/ai/saver-to-investor
exports.getSaverToInvestorPlan = async (req, res) => {
  try {
    const plan = await generateSaverToInvestorPlan(req.user.id);
    return res.status(200).json(plan);
  } catch (error) {
    console.error("Saver to investor plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate savings-to-investment plan.",
    });
  }
};

// POST /api/ai/saver-to-investor/execute
exports.executeSaverPlan = async (req, res) => {
  try {
    const result = await executeSaverPlan(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Execute saver plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to execute investment allocation.",
    });
  }
};
