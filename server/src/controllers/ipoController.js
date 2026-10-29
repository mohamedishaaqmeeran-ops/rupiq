const IpoItem = require("../models/IpoItem");

const DEFAULT_IPOS = [
  {
    companyName: "Swiggy Limited",
    symbol: "SWIGGY",
    category: "Mainboard",
    status: "OPEN",
    issuePrice: 390,
    lotSize: 38,
    minInvestment: 14820,
    gmp: 85,
    gmpPercent: 21.8,
    subscriptionOverall: 14.2,
    openDate: "28 Oct 2026",
    closeDate: "31 Oct 2026",
    listingDate: "06 Nov 2026",
    rating: "HIGH DEMAND • APPLY",
  },
  {
    companyName: "Waaree Energies Limited",
    symbol: "WAAREE",
    category: "Mainboard",
    status: "CLOSED",
    issuePrice: 1503,
    lotSize: 9,
    minInvestment: 13527,
    gmp: 1320,
    gmpPercent: 87.8,
    subscriptionOverall: 76.3,
    openDate: "21 Oct 2026",
    closeDate: "23 Oct 2026",
    listingDate: "28 Oct 2026",
    rating: "BLOCKBUSTER LISTING",
  },
  {
    companyName: "Afcons Infrastructure",
    symbol: "AFCONS",
    category: "Mainboard",
    status: "OPEN",
    issuePrice: 463,
    lotSize: 32,
    minInvestment: 14816,
    gmp: 55,
    gmpPercent: 11.9,
    subscriptionOverall: 4.8,
    openDate: "25 Oct 2026",
    closeDate: "29 Oct 2026",
    listingDate: "04 Nov 2026",
    rating: "MODERATE • LONG TERM",
  },
  {
    companyName: "Apex CleanTech Green SME",
    symbol: "APEXCLEAN",
    category: "SME",
    status: "UPCOMING",
    issuePrice: 115,
    lotSize: 1200,
    minInvestment: 138000,
    gmp: 92,
    gmpPercent: 80.0,
    subscriptionOverall: 0,
    openDate: "03 Nov 2026",
    closeDate: "06 Nov 2026",
    listingDate: "11 Nov 2026",
    rating: "MULTIBAGGER SME POTENTIAL",
  },
];

const DEFAULT_DIVIDENDS = [
  { company: "Vedanta Limited", symbol: "VEDL", yieldPercent: 12.8, annualPayout: "₹42.50 / share", upcomingDate: "15 Nov 2026" },
  { company: "Coal India Limited", symbol: "COALINDIA", yieldPercent: 6.4, annualPayout: "₹25.50 / share", upcomingDate: "20 Nov 2026" },
  { company: "ITC Limited", symbol: "ITC", yieldPercent: 3.2, annualPayout: "₹15.75 / share", upcomingDate: "04 Dec 2026" },
  { company: "Tata Consultancy Services", symbol: "TCS", yieldPercent: 2.1, annualPayout: "₹73.00 / share", upcomingDate: "18 Jan 2027" },
];

exports.getIpos = async (req, res) => {
  try {
    let list = await IpoItem.find().sort({ gmpPercent: -1 });
    if (list.length === 0) {
      list = await IpoItem.insertMany(DEFAULT_IPOS);
    }

    res.json({
      success: true,
      data: {
        ipos: list,
        dividends: DEFAULT_DIVIDENDS,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
