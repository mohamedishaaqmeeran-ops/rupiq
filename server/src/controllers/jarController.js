const PaisaJar = require("../models/PaisaJar");
const Transaction = require("../models/Transaction");
const { DigitalGoldHolding, DigitalGoldOrder } = require("../models/DigitalGold");

// GET /api/jar
exports.getJarStatus = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    let jar = await PaisaJar.findOne({ user: userId });
    if (!jar) {
      jar = await PaisaJar.create({
        user: userId,
        isEnabled: true,
        roundUpTo: 10,
        currentJarBalance: 164,
        lifetimeJarSaved: 2850,
        autoInvestTarget: "GOLD",
      });
    }

    // Inspect recent expenses to compute spare change history
    const recentExpenses = await Transaction.find({ user: userId, type: "expense" })
      .sort({ date: -1 })
      .limit(8);

    const roundUpHistory = recentExpenses.map((tx) => {
      const step = jar.roundUpTo || 10;
      const rem = tx.amount % step;
      const roundUp = rem === 0 ? 0 : step - rem;
      return {
        txId: tx._id,
        category: tx.category,
        description: tx.description,
        actualAmount: tx.amount,
        roundedTotal: tx.amount + roundUp,
        spareChange: roundUp,
        date: tx.date,
      };
    });

    res.status(200).json({
      success: true,
      jar,
      recentRoundUps: roundUpHistory,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/jar/config
exports.updateConfig = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { isEnabled, roundUpTo, autoInvestTarget, autoInvestThreshold } = req.body;

    let jar = await PaisaJar.findOne({ user: userId });
    if (!jar) {
      jar = new PaisaJar({ user: userId });
    }

    if (isEnabled !== undefined) jar.isEnabled = isEnabled;
    if (roundUpTo !== undefined) jar.roundUpTo = roundUpTo;
    if (autoInvestTarget !== undefined) jar.autoInvestTarget = autoInvestTarget;
    if (autoInvestThreshold !== undefined) jar.autoInvestThreshold = autoInvestThreshold;

    await jar.save();

    res.status(200).json({ success: true, message: "PaisaJar settings updated.", jar });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/jar/invest
exports.investJarBalance = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let jar = await PaisaJar.findOne({ user: userId });
    if (!jar || jar.currentJarBalance <= 0) {
      return res.status(400).json({ success: false, message: "No spare change balance in Jar to invest." });
    }

    const investAmount = jar.currentJarBalance;

    // Automatically buy Digital Gold with Jar balance
    const goldRate = 7865;
    const grams = Math.round((investAmount / goldRate) * 10000) / 10000;

    let holding = await DigitalGoldHolding.findOne({ user: userId, assetType: "GOLD_24K" });
    if (!holding) {
      holding = new DigitalGoldHolding({ user: userId, assetType: "GOLD_24K", gramsHeld: 0, totalInvested: 0 });
    }

    holding.gramsHeld = Math.round((holding.gramsHeld + grams) * 10000) / 10000;
    holding.totalInvested = Math.round((holding.totalInvested + investAmount) * 100) / 100;
    holding.averageBuyPricePerGram = Math.round((holding.totalInvested / holding.gramsHeld) * 100) / 100;
    await holding.save();

    // Order record
    await DigitalGoldOrder.create({
      user: userId,
      assetType: "GOLD_24K",
      orderType: "BUY",
      grams,
      amount: investAmount,
      ratePerGram: goldRate,
      paymentMethod: "PaisaJar Spare Change",
      status: "SUCCESS",
    });

    // Update Jar
    jar.lifetimeJarSaved = Math.round((jar.lifetimeJarSaved + investAmount) * 100) / 100;
    jar.currentJarBalance = 0;
    jar.lastInvestedAt = new Date();
    await jar.save();

    res.status(200).json({
      success: true,
      message: `Successfully invested ₹${investAmount} spare change into ${grams}g of 24K Digital Gold!`,
      grams,
      investAmount,
      jar,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
