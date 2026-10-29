const { DigitalGoldHolding, DigitalGoldOrder } = require("../models/DigitalGold");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

// Realistic base market rates for 24K 99.9% Purity (INR per gram)
function getLiveRates() {
  // Minor organic variance based on minute of day
  const minute = new Date().getMinutes();
  const goldVariance = (minute % 10) * 1.8 - 9;
  const silverVariance = (minute % 5) * 0.15 - 0.35;

  const goldRate = Math.round((7865 + goldVariance) * 100) / 100;
  const silverRate = Math.round((92.4 + silverVariance) * 100) / 100;

  return {
    gold24k: {
      ratePerGram: goldRate,
      changePercent24h: +0.64,
      purity: "24K 99.9%",
      certifiedBy: "MMTC-PAMP / BIS Hallmarked",
    },
    silver999: {
      ratePerGram: silverRate,
      changePercent24h: +1.12,
      purity: "99.9% Fine Silver",
      certifiedBy: "Augmont Bullion",
    },
    timestamp: new Date().toISOString(),
  };
}

// GET /api/gold/rates
exports.getRates = (req, res) => {
  res.status(200).json({ success: true, rates: getLiveRates() });
};

// GET /api/gold/vault
exports.getVault = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const rates = getLiveRates();

    let goldHolding = await DigitalGoldHolding.findOne({ user: userId, assetType: "GOLD_24K" });
    if (!goldHolding) {
      goldHolding = await DigitalGoldHolding.create({ user: userId, assetType: "GOLD_24K", gramsHeld: 0.15, totalInvested: 1100, averageBuyPricePerGram: 7333 });
    }

    let silverHolding = await DigitalGoldHolding.findOne({ user: userId, assetType: "SILVER_999" });
    if (!silverHolding) {
      silverHolding = await DigitalGoldHolding.create({ user: userId, assetType: "SILVER_999", gramsHeld: 10, totalInvested: 880, averageBuyPricePerGram: 88 });
    }

    const goldCurrentVal = Math.round(goldHolding.gramsHeld * rates.gold24k.ratePerGram * 100) / 100;
    const goldPnl = Math.round((goldCurrentVal - goldHolding.totalInvested) * 100) / 100;

    const silverCurrentVal = Math.round(silverHolding.gramsHeld * rates.silver999.ratePerGram * 100) / 100;
    const silverPnl = Math.round((silverCurrentVal - silverHolding.totalInvested) * 100) / 100;

    const recentOrders = await DigitalGoldOrder.find({ user: userId }).sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      success: true,
      rates,
      vault: {
        totalVaultValue: Math.round((goldCurrentVal + silverCurrentVal) * 100) / 100,
        totalInvested: Math.round((goldHolding.totalInvested + silverHolding.totalInvested) * 100) / 100,
        totalPnl: Math.round((goldPnl + silverPnl) * 100) / 100,
        gold: {
          ...goldHolding.toObject(),
          currentValue: goldCurrentVal,
          pnl: goldPnl,
          currentRate: rates.gold24k.ratePerGram,
        },
        silver: {
          ...silverHolding.toObject(),
          currentValue: silverCurrentVal,
          pnl: silverPnl,
          currentRate: rates.silver999.ratePerGram,
        },
      },
      recentOrders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/gold/buy
exports.buyAsset = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { assetType = "GOLD_24K", amountInRupees, gramsToBuy, accountId } = req.body;

    const rates = getLiveRates();
    const ratePerGram = assetType === "SILVER_999" ? rates.silver999.ratePerGram : rates.gold24k.ratePerGram;

    let finalAmount = 0;
    let finalGrams = 0;

    if (amountInRupees && parseFloat(amountInRupees) > 0) {
      finalAmount = parseFloat(amountInRupees);
      finalGrams = Math.round((finalAmount / ratePerGram) * 10000) / 10000;
    } else if (gramsToBuy && parseFloat(gramsToBuy) > 0) {
      finalGrams = parseFloat(gramsToBuy);
      finalAmount = Math.round(finalGrams * ratePerGram * 100) / 100;
    } else {
      return res.status(400).json({ success: false, message: "Specify amount in Rupees or Grams to buy." });
    }

    if (finalAmount < 10) {
      return res.status(400).json({ success: false, message: "Minimum investment is ₹10." });
    }

    // Debit linked account
    let account = null;
    if (accountId) {
      account = await Account.findOne({ _id: accountId, user: userId, isActive: true });
    }
    if (!account) {
      account = await Account.findOne({ user: userId, isActive: true });
    }

    if (account && account.balance < finalAmount && account.type !== "credit_card") {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance in ${account.name} (Available: ₹${account.balance.toLocaleString("en-IN")})`,
      });
    }

    if (account) {
      account.balance = Math.max(0, Math.round((account.balance - finalAmount) * 100) / 100);
      await account.save();
    }

    // Update holding
    let holding = await DigitalGoldHolding.findOne({ user: userId, assetType });
    if (!holding) {
      holding = await DigitalGoldHolding.create({ user: userId, assetType, gramsHeld: 0, totalInvested: 0, averageBuyPricePerGram: 0 });
    }

    const newTotalGrams = Math.round((holding.gramsHeld + finalGrams) * 10000) / 10000;
    const newTotalInvested = Math.round((holding.totalInvested + finalAmount) * 100) / 100;
    holding.gramsHeld = newTotalGrams;
    holding.totalInvested = newTotalInvested;
    holding.averageBuyPricePerGram = Math.round((newTotalInvested / newTotalGrams) * 100) / 100;
    await holding.save();

    // Record order
    const order = await DigitalGoldOrder.create({
      user: userId,
      assetType,
      orderType: "BUY",
      grams: finalGrams,
      amount: finalAmount,
      ratePerGram,
      paymentMethod: account ? account.name : "UPI FastPay",
      status: "SUCCESS",
    });

    // Record in ledger
    await Transaction.create({
      user: userId,
      type: "expense",
      amount: finalAmount,
      category: "Investments",
      description: `Bought ${finalGrams}g ${assetType === "GOLD_24K" ? "24K Gold" : "99.9% Silver"}`,
      paymentMethod: "UPI",
      date: new Date(),
    });

    res.status(200).json({
      success: true,
      message: `Successfully purchased ${finalGrams}g of ${assetType === "GOLD_24K" ? "24K 99.9% Gold" : "99.9% Silver"} for ₹${finalAmount.toLocaleString("en-IN")}!`,
      order,
      vault: holding,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/gold/sell
exports.sellAsset = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { assetType = "GOLD_24K", gramsToSell } = req.body;

    const numGrams = parseFloat(gramsToSell);
    if (isNaN(numGrams) || numGrams <= 0) {
      return res.status(400).json({ success: false, message: "Specify valid grams to sell." });
    }

    const holding = await DigitalGoldHolding.findOne({ user: userId, assetType });
    if (!holding || holding.gramsHeld < numGrams) {
      return res.status(400).json({
        success: false,
        message: `Insufficient vault balance. You own ${holding ? holding.gramsHeld : 0}g of ${assetType}.`,
      });
    }

    const rates = getLiveRates();
    const ratePerGram = assetType === "SILVER_999" ? rates.silver999.ratePerGram : rates.gold24k.ratePerGram;
    const payoutAmount = Math.round(numGrams * ratePerGram * 0.985 * 100) / 100; // 1.5% spread/GST buffer

    // Deduct holding
    holding.gramsHeld = Math.round((holding.gramsHeld - numGrams) * 10000) / 10000;
    holding.totalInvested = Math.max(0, Math.round((holding.totalInvested - payoutAmount) * 100) / 100);
    await holding.save();

    // Credit user's bank account
    const account = await Account.findOne({ user: userId, type: "bank", isActive: true });
    if (account) {
      account.balance = Math.round((account.balance + payoutAmount) * 100) / 100;
      await account.save();
    }

    // Record order
    const order = await DigitalGoldOrder.create({
      user: userId,
      assetType,
      orderType: "SELL",
      grams: numGrams,
      amount: payoutAmount,
      ratePerGram,
      paymentMethod: account ? account.name : "Direct Bank Transfer",
      status: "SUCCESS",
    });

    // Record income transaction
    await Transaction.create({
      user: userId,
      type: "income",
      amount: payoutAmount,
      category: "Investments",
      description: `Sold ${numGrams}g ${assetType === "GOLD_24K" ? "Digital Gold" : "Digital Silver"}`,
      paymentMethod: "Bank Transfer",
      date: new Date(),
    });

    res.status(200).json({
      success: true,
      message: `Sold ${numGrams}g of ${assetType} for ₹${payoutAmount.toLocaleString("en-IN")}. Funds credited to your bank account!`,
      order,
      remainingHolding: holding,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/gold/sip
exports.configureSip = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { assetType = "GOLD_24K", sipActive, sipAmount = 500, sipFrequency = "WEEKLY" } = req.body;

    let holding = await DigitalGoldHolding.findOne({ user: userId, assetType });
    if (!holding) {
      holding = await DigitalGoldHolding.create({ user: userId, assetType });
    }

    holding.sipActive = Boolean(sipActive);
    holding.sipAmount = parseFloat(sipAmount) || 500;
    holding.sipFrequency = sipFrequency;
    await holding.save();

    res.status(200).json({
      success: true,
      message: `Gold SIP ${holding.sipActive ? "activated" : "paused"} (₹${holding.sipAmount} ${holding.sipFrequency}).`,
      holding,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
