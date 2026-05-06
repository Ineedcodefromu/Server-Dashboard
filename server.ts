import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import Parser from "rss-parser";
import dotenv from "dotenv";
import si from "systeminformation";
import YahooFinance from 'yahoo-finance2';

dotenv.config();

const yahooFinance = new YahooFinance();
const parser = new Parser();

// Simple cache for exchange rate
let eurUsdRate = 0.92; // Default fallback
let lastRateUpdate = 0;

async function getExchangeRate() {
  const now = Date.now();
  if (now - lastRateUpdate < 3600000 && eurUsdRate !== 0.92) { // Cache for 1 hour
    return eurUsdRate;
  }

  try {
    const result = await yahooFinance.quote('EURUSD=X');
    if (result && result.regularMarketPrice) {
      eurUsdRate = 1 / result.regularMarketPrice; // We want USD -> EUR
      lastRateUpdate = now;
    }
  } catch (error) {
    console.error("Failed to fetch exchange rate, using fallback", error);
  }
  return eurUsdRate;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Real Performance Data
  app.get("/api/performance", async (req, res) => {
    try {
      const [cpu, mem, fsSize] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize()
      ]);

      // Calculate totals for primary storage
      const primaryFs = fsSize[0]; // Take first mount point as primary

      res.json({
        cpu: Math.round(cpu.currentLoad),
        ram: Math.round((mem.active / mem.total) * 100),
        storageUsed: primaryFs ? Math.round(primaryFs.use) : 0,
        storageTotal: primaryFs ? Math.round(primaryFs.size / (1024 * 1024 * 1024)) : 0, // GB
        storageUsedGB: primaryFs ? Math.round(primaryFs.used / (1024 * 1024 * 1024)) : 0, // GB
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch system metrics" });
    }
  });

  // RSS Proxy
  app.get("/api/rss", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const feed = await parser.parseURL(url);
      res.json(feed);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Real Stock API using Yahoo Finance
  app.get("/api/stocks", async (req, res) => {
    const symbolsRaw = req.query.symbols as string || "";
    if (!symbolsRaw) return res.json([]);
    
    const symbols = symbolsRaw.split(",").map(s => s.trim().toUpperCase());
    const rate = await getExchangeRate();

    try {
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const quote = await yahooFinance.quote(symbol);
            if (!quote) return null;

            const originalPrice = quote.regularMarketPrice || 0;
            const originalChange = quote.regularMarketChange || 0;
            const currency = quote.currency || 'USD';

            let priceEUR = originalPrice;
            let changeEUR = originalChange;

            if (currency === 'USD') {
              priceEUR = originalPrice * rate;
              changeEUR = originalChange * rate;
            } else if (currency === 'EUR') {
              // already EUR
            }

            return {
              symbol: symbol,
              name: quote.shortName || quote.longName || symbol,
              price: originalPrice.toFixed(2),
              change: originalChange.toFixed(2),
              priceEUR: priceEUR.toFixed(2),
              changeEUR: changeEUR.toFixed(2),
              changePercent: (quote.regularMarketChangePercent || 0).toFixed(2),
              currency: currency,
              updatedAt: new Date().toISOString()
            };
          } catch (e) {
            console.error(`Failed to fetch ${symbol}:`, e);
            return null;
          }
        })
      );

      res.json({
        stocks: results.filter(r => r !== null),
        eurUsdRate: rate
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch stock data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OmniDash running on http://localhost:${PORT}`);
  });
}

startServer();
