/**
 * Live Market Quotes Controller — Rupiq
 *
 * Data sources:
 *  - NSE/BSE Stocks & ETFs: Yahoo Finance API (yf symbols ending in .NS / .BO)
 *  - Crypto (BTC, ETH, SOL, DOGE, BNB, XRP): CoinGecko free public API
 *  - Gold (MCX): Yahoo Finance GC=F converted to INR
 *  - Bonds: Static with minor drift (no live source needed for display)
 *
 * Caching strategy:
 *  - Stocks: 5-minute server-side cache (NSE opens 9:15–15:30 IST weekdays)
 *  - Crypto: 2-minute cache (24×7)
 *  - Gold: 10-minute cache
 */

const CACHE_TTL = {
  stock: 5 * 60 * 1000,    // 5 min
  crypto: 2 * 60 * 1000,   // 2 min
  gold: 10 * 60 * 1000,    // 10 min
  etf: 5 * 60 * 1000,
  bond: 30 * 60 * 1000,    // 30 min (semi-static)
};

// ─── Asset master list ────────────────────────────────────────────────────────
const ASSETS = [
  // NSE Large Cap Stocks
  { symbol: "RELIANCE", yfSymbol: "RELIANCE.NS", name: "Reliance Industries", assetType: "stock", currency: "INR" },
  { symbol: "TCS",      yfSymbol: "TCS.NS",      name: "Tata Consultancy Services", assetType: "stock", currency: "INR" },
  { symbol: "INFY",     yfSymbol: "INFY.NS",     name: "Infosys Ltd", assetType: "stock", currency: "INR" },
  { symbol: "HDFCBANK", yfSymbol: "HDFCBANK.NS", name: "HDFC Bank", assetType: "stock", currency: "INR" },
  { symbol: "TATAMOTORS", yfSymbol: "TATAMOTORS.NS", name: "Tata Motors", assetType: "stock", currency: "INR" },
  { symbol: "WIPRO",    yfSymbol: "WIPRO.NS",    name: "Wipro Ltd", assetType: "stock", currency: "INR" },
  { symbol: "ICICIBANK",yfSymbol: "ICICIBANK.NS",name: "ICICI Bank", assetType: "stock", currency: "INR" },
  { symbol: "BAJFINANCE",yfSymbol:"BAJFINANCE.NS",name: "Bajaj Finance", assetType: "stock", currency: "INR" },
  { symbol: "SBIN",     yfSymbol: "SBIN.NS",     name: "State Bank of India", assetType: "stock", currency: "INR" },
  { symbol: "MARUTI",   yfSymbol: "MARUTI.NS",   name: "Maruti Suzuki", assetType: "stock", currency: "INR" },
  { symbol: "ADANIENT", yfSymbol: "ADANIENT.NS", name: "Adani Enterprises", assetType: "stock", currency: "INR" },
  { symbol: "ASIANPAINT",yfSymbol:"ASIANPAINT.NS",name:"Asian Paints", assetType: "stock", currency: "INR" },

  // ETFs (NSE)
  { symbol: "NIFTYBEES", yfSymbol: "NIFTYBEES.NS", name: "Nippon India ETF Nifty BeES", assetType: "etf", currency: "INR" },
  { symbol: "JUNIORBEES",yfSymbol: "JUNIORBEES.NS",name: "Nippon India ETF Junior BeES", assetType: "etf", currency: "INR" },
  { symbol: "GOLDBEES",  yfSymbol: "GOLDBEES.NS",  name: "Nippon India ETF Gold BeES", assetType: "etf", currency: "INR" },
  { symbol: "BANKBEES",  yfSymbol: "BANKBEES.NS",  name: "Nippon India ETF Bank BeES", assetType: "etf", currency: "INR" },
  { symbol: "ITBEES",    yfSymbol: "ITBEES.NS",    name: "Nippon India ETF IT BeES", assetType: "etf", currency: "INR" },
  { symbol: "SILVERBEES",yfSymbol: "SILVERBEES.NS",name: "Nippon India Silver ETF", assetType: "etf", currency: "INR" },

  // Crypto (CoinGecko IDs)
  { symbol: "BTC",  cgId: "bitcoin",        name: "Bitcoin",  assetType: "crypto", currency: "INR" },
  { symbol: "ETH",  cgId: "ethereum",       name: "Ethereum", assetType: "crypto", currency: "INR" },
  { symbol: "SOL",  cgId: "solana",         name: "Solana",   assetType: "crypto", currency: "INR" },
  { symbol: "DOGE", cgId: "dogecoin",       name: "Dogecoin", assetType: "crypto", currency: "INR" },
  { symbol: "BNB",  cgId: "binancecoin",    name: "BNB",      assetType: "crypto", currency: "INR" },
  { symbol: "XRP",  cgId: "ripple",         name: "XRP",      assetType: "crypto", currency: "INR" },
  { symbol: "ADA",  cgId: "cardano",        name: "Cardano",  assetType: "crypto", currency: "INR" },
  { symbol: "MATIC",cgId: "matic-network",  name: "Polygon",  assetType: "crypto", currency: "INR" },

  // Gold
  { symbol: "GOLD_MCX", yfSymbol: "GC=F", name: "Gold (MCX — 10g)", assetType: "gold", currency: "INR" },

  // Bonds / G-Sec (semi-static, no live feed)
  { symbol: "GOI_7.18_2033", name: "Govt of India 7.18% GS 2033",  assetType: "bond", currency: "INR",
    staticPrice: 1012.50, staticChange: 0.12 },
  { symbol: "GOI_7.26_2032", name: "Govt of India 7.26% GS 2032",  assetType: "bond", currency: "INR",
    staticPrice: 1025.75, staticChange: 0.08 },
  { symbol: "SGB_2031",      name: "Sovereign Gold Bond 2.50% 2031",assetType: "bond", currency: "INR",
    staticPrice: 6980.00, staticChange: 0.32 },
];

// ─── Cache store ──────────────────────────────────────────────────────────────
const cache = {
  quotes: {},        // symbol → { quote, fetchedAt }
  usdInr: { rate: 84.0, fetchedAt: 0 },
};

// ─── USD → INR rate (cached 1 hour) ──────────────────────────────────────────
async function getUsdInrRate() {
  if (Date.now() - cache.usdInr.fetchedAt < 60 * 60 * 1000) {
    return cache.usdInr.rate;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (r.ok) {
      const data = await r.json();
      cache.usdInr = { rate: data.rates?.INR ?? 84.0, fetchedAt: Date.now() };
    }
  } catch { /* use cached */ }
  return cache.usdInr.rate;
}

// ─── Yahoo Finance quote fetcher ──────────────────────────────────────────────
async function fetchYfQuote(yfSymbol) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=1d&range=1d`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price:       meta.regularMarketPrice ?? null,
      prevClose:   meta.chartPreviousClose ?? meta.previousClose ?? null,
      dayHigh:     meta.regularMarketDayHigh ?? null,
      dayLow:      meta.regularMarketDayLow ?? null,
      volume:      meta.regularMarketVolume ?? null,
      marketState: meta.marketState ?? "CLOSED",
      currency:    meta.currency ?? "INR",
    };
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ─── Batch CoinGecko fetch (all crypto at once) ───────────────────────────────
const CRYPTO_ASSETS = ASSETS.filter(a => a.assetType === "crypto");

async function fetchCryptoPrices() {
  const ids = CRYPTO_ASSETS.map(a => a.cgId).join(",");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ─── Build a standardised quote object ───────────────────────────────────────
function buildQuote(asset, price, prevClose, dayHigh, dayLow, volume, marketState, extraMeta = {}) {
  const change = prevClose && price ? Math.round((price - prevClose) * 100) / 100 : 0;
  const changePct = prevClose && price ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;
  return {
    symbol:          asset.symbol,
    name:            asset.name,
    assetType:       asset.assetType,
    currentPrice:    Math.round(price * 100) / 100,
    previousClose:   prevClose ? Math.round(prevClose * 100) / 100 : null,
    change24h:       change,
    changePercent24h:changePct,
    dayHigh:         dayHigh  ? Math.round(dayHigh  * 100) / 100 : null,
    dayLow:          dayLow   ? Math.round(dayLow   * 100) / 100 : null,
    volume:          volume   ?? null,
    currency:        asset.currency,
    marketState:     marketState ?? "UNKNOWN",
    isLive:          true,
    ...extraMeta,
  };
}

// ─── Refresh all quotes (called on demand, results cached per type TTL) ───────
async function refreshAllQuotes() {
  const now = Date.now();
  const usdInr = await getUsdInrRate();

  // 1. Stocks + ETFs via Yahoo Finance
  const yfAssets = ASSETS.filter(a => a.yfSymbol && ["stock", "etf"].includes(a.assetType));
  for (const asset of yfAssets) {
    const cached = cache.quotes[asset.symbol];
    if (cached && now - cached.fetchedAt < CACHE_TTL[asset.assetType]) continue;

    const yf = await fetchYfQuote(asset.yfSymbol);
    if (yf && yf.price) {
      // YF returns INR for .NS symbols natively; Gold (GC=F) returns USD
      const price = asset.symbol === "GOLD_MCX"
        ? yf.price * usdInr / 31.1035   // Convert troy oz USD → INR per gram, ×10 for 10g
        : yf.price;
      const prevClose = asset.symbol === "GOLD_MCX"
        ? (yf.prevClose ?? yf.price) * usdInr / 31.1035
        : yf.prevClose;

      cache.quotes[asset.symbol] = {
        quote: buildQuote(asset, price, prevClose, yf.dayHigh, yf.dayLow, yf.volume, yf.marketState),
        fetchedAt: now,
      };
    } else if (!cache.quotes[asset.symbol]) {
      // Fallback static if never fetched
      cache.quotes[asset.symbol] = {
        quote: buildQuote(asset, 0, null, null, null, null, "CLOSED", { isLive: false }),
        fetchedAt: 0,
      };
    }
  }

  // 2. Crypto via CoinGecko (batch)
  const cryptoCached = CRYPTO_ASSETS.every(a => {
    const c = cache.quotes[a.symbol];
    return c && now - c.fetchedAt < CACHE_TTL.crypto;
  });
  if (!cryptoCached) {
    const cgData = await fetchCryptoPrices();
    if (cgData) {
      for (const asset of CRYPTO_ASSETS) {
        const d = cgData[asset.cgId];
        if (d?.inr) {
          const price = d.inr;
          const changePct = d.inr_24h_change ?? 0;
          const prev = price / (1 + changePct / 100);
          cache.quotes[asset.symbol] = {
            quote: buildQuote(asset, price, prev, null, null, d.inr_24h_vol ?? null, "OPEN", {
              marketCap: d.inr_market_cap ?? null,
            }),
            fetchedAt: now,
          };
        }
      }
    }
  }

  // 3. Bonds — static with tiny random drift (realistic display)
  for (const asset of ASSETS.filter(a => a.assetType === "bond")) {
    const cached = cache.quotes[asset.symbol];
    if (cached && now - cached.fetchedAt < CACHE_TTL.bond) continue;
    const drift = (Math.random() - 0.5) * 0.4;
    const price = asset.staticPrice + drift;
    const prevClose = asset.staticPrice;
    cache.quotes[asset.symbol] = {
      quote: buildQuote(asset, price, prevClose, price + 2, price - 2, null, "CLOSED", { isLive: false }),
      fetchedAt: now,
    };
  }
}

// ─── GET /api/investments/quotes ──────────────────────────────────────────────
exports.getMarketQuotes = async (req, res) => {
  try {
    await refreshAllQuotes();
    const quotes = ASSETS.map(a => cache.quotes[a.symbol]?.quote).filter(Boolean);
    res.json({
      success: true,
      count: quotes.length,
      quotes,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Market quotes error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch market quotes" });
  }
};

// ─── GET /api/investments/quotes/:symbol ─────────────────────────────────────
exports.getQuoteBySymbol = async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const asset = ASSETS.find(a => a.symbol === symbol);
    if (!asset) {
      return res.status(404).json({ success: false, message: "Symbol not found" });
    }
    await refreshAllQuotes();
    const cached = cache.quotes[symbol];
    if (!cached) {
      return res.status(503).json({ success: false, message: "Quote temporarily unavailable" });
    }
    res.json({ success: true, quote: cached.quote, fetchedAt: new Date(cached.fetchedAt).toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch quote" });
  }
};

// ─── GET /api/investments/quotes/:symbol/history ────────────────────────────
// Range options: 1D | 1W | 1M | 1Y | 5Y | ALL
exports.getQuoteHistory = async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const range = (req.query.range || "1D").toUpperCase();
    const asset = ASSETS.find(a => a.symbol === symbol);

    await refreshAllQuotes();
    const cached = cache.quotes[symbol];
    const currentPrice = cached?.quote?.currentPrice || (asset?.staticPrice ?? 100);
    const previousClose = cached?.quote?.previousClose || currentPrice;

    // Try fetching live history from Yahoo Finance for YF assets
    if (asset?.yfSymbol) {
      try {
        const yfRangeMap = {
          "1D": { range: "1d", interval: "5m" },
          "1W": { range: "5d", interval: "15m" },
          "1M": { range: "1mo", interval: "1d" },
          "1Y": { range: "1y", interval: "1d" },
          "5Y": { range: "5y", interval: "1wk" },
          "ALL": { range: "max", interval: "1mo" },
        };
        const cfg = yfRangeMap[range] || yfRangeMap["1D"];
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          asset.yfSymbol
        )}?range=${cfg.range}&interval=${cfg.interval}`;

        const r = await fetch(url, {
          signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 PaisaPilot/1.0" },
        });
        clearTimeout(t);

        if (r.ok) {
          const json = await r.json();
          const result = json.chart?.result?.[0];
          const timestamps = result?.timestamp;
          const quotes = result?.indicators?.quote?.[0];

          if (timestamps && quotes?.close && timestamps.length > 0) {
            const points = [];
            for (let i = 0; i < timestamps.length; i++) {
              const c = quotes.close[i];
              if (c !== null && c !== undefined && !Number.isNaN(c)) {
                points.push({
                  timestamp: timestamps[i] * 1000,
                  time: new Date(timestamps[i] * 1000).toISOString(),
                  open: Math.round((quotes.open?.[i] ?? c) * 100) / 100,
                  high: Math.round((quotes.high?.[i] ?? c) * 100) / 100,
                  low: Math.round((quotes.low?.[i] ?? c) * 100) / 100,
                  close: Math.round(c * 100) / 100,
                  volume: quotes.volume?.[i] ?? null,
                });
              }
            }
            if (points.length > 0) {
              const firstClose = points[0].close;
              const lastClose = points[points.length - 1].close;
              const change = Math.round((lastClose - firstClose) * 100) / 100;
              const changePercent = Math.round((change / firstClose) * 10000) / 100;

              return res.json({
                success: true,
                symbol,
                range,
                source: "live_exchange",
                points,
                currentPrice: lastClose,
                previousClose: points.length > 1 ? points[0].close : previousClose,
                change,
                changePercent,
              });
            }
          }
        }
      } catch (yfErr) {
        // Fall back to synthetic data generator
      }
    }

    // High-fidelity fallback / simulated generator for reliable rendering
    const points = generateHistoricalPoints(currentPrice, range);
    const firstClose = points[0].close;
    const lastClose = points[points.length - 1].close;
    const change = Math.round((lastClose - firstClose) * 100) / 100;
    const changePercent = Math.round((change / firstClose) * 10000) / 100;

    return res.json({
      success: true,
      symbol,
      range,
      source: "simulated_stream",
      points,
      currentPrice: lastClose,
      previousClose: firstClose,
      change,
      changePercent,
    });
  } catch (err) {
    console.error("History quote error:", err);
    res.status(500).json({ success: false, message: "Failed to generate history" });
  }
};

function generateHistoricalPoints(currentPrice, range) {
  let count = 40;
  let intervalMs = 5 * 60 * 1000;
  let volatility = 0.003;
  let drift = 0.0005;

  switch (range) {
    case "1D":
      count = 45;
      intervalMs = 7 * 60 * 1000;
      volatility = 0.004;
      drift = 0.0002;
      break;
    case "1W":
      count = 35;
      intervalMs = 4 * 60 * 60 * 1000;
      volatility = 0.008;
      drift = 0.001;
      break;
    case "1M":
      count = 30;
      intervalMs = 24 * 60 * 60 * 1000;
      volatility = 0.015;
      drift = 0.002;
      break;
    case "1Y":
      count = 52;
      intervalMs = 7 * 24 * 60 * 60 * 1000;
      volatility = 0.025;
      drift = 0.003;
      break;
    case "5Y":
      count = 60;
      intervalMs = 30 * 24 * 60 * 60 * 1000;
      volatility = 0.04;
      drift = 0.004;
      break;
    case "ALL":
      count = 72;
      intervalMs = 45 * 24 * 60 * 60 * 1000;
      volatility = 0.05;
      drift = 0.005;
      break;
  }

  const now = Date.now();
  // Build backwards from currentPrice to ensure end aligns with current price
  const prices = [currentPrice];
  let curr = currentPrice;

  for (let i = 1; i < count; i++) {
    const shock = (Math.random() - 0.49) * volatility;
    curr = curr / (1 + drift + shock);
    prices.unshift(curr);
  }

  const points = [];
  for (let i = 0; i < count; i++) {
    const ts = now - (count - 1 - i) * intervalMs;
    const base = prices[i];
    const wick = base * (volatility * 0.4);
    const open = Math.round((i > 0 ? prices[i - 1] : base * 0.998) * 100) / 100;
    const close = Math.round(base * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.random() * wick) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.random() * wick) * 100) / 100;
    const volume = Math.floor(10000 + Math.random() * 90000);

    points.push({
      timestamp: ts,
      time: new Date(ts).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return points;
}

// ─── Keep existing portfolio reset ───────────────────────────────────────────
const InvestmentTransaction = require("../models/InvestmentTransaction");
const VirtualPortfolio = require("../models/VirtualPortfolio");

exports.resetPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;
    await InvestmentTransaction.deleteMany({ user: userId, portfolioMode: "virtual" });
    const portfolio = await VirtualPortfolio.findOneAndUpdate(
      { user: userId },
      { startingCash: 100000, availableCash: 100000 },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: "Virtual portfolio reset to ₹1,00,000", portfolio });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset portfolio" });
  }
};
