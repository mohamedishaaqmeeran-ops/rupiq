
const VirtualPortfolio = require("../models/VirtualPortfolio");

// GET /api/investments/portfolio
exports.getVirtualPortfolio = async (req, res) => {
  try {
    let portfolio = await VirtualPortfolio.findOne({
      user: req.user.id,
    });

    if (!portfolio) {
      portfolio = await VirtualPortfolio.create({
        user: req.user.id,
        startingCash: 100000,
        availableCash: 100000,
      });
    }

    return res.status(200).json({
      success: true,
      portfolio,
    });
  } catch (error) {
    // Another request may create the portfolio concurrently.
    if (error.code === 11000) {
      try {
        const portfolio = await VirtualPortfolio.findOne({
          user: req.user.id,
        });

        if (portfolio) {
          return res.status(200).json({
            success: true,
            portfolio,
          });
        }
      } catch (lookupError) {
        console.error("Portfolio lookup error:", lookupError);
      }
    }

    console.error("Get virtual portfolio error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load virtual portfolio.",
    });
  }
};
