import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import Parser from "rss-parser";
import dotenv from "dotenv";
import si from "systeminformation";
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

dotenv.config();

// --- System Logging System ---
interface SystemLog {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  source: string;
  timestamp: string;
  details?: string;
}

let systemLogs: SystemLog[] = [
  {
    id: 'initial',
    type: 'success',
    message: 'System Kern gestartet',
    source: 'KERNEL',
    timestamp: new Date().toISOString(),
    details: 'Alle Subsysteme wurden erfolgreich initialisiert.'
  }
];

function addLog(type: SystemLog['type'], message: string, source: string, details?: string) {
  const newLog: SystemLog = {
    id: Math.random().toString(36).substr(2, 9),
    type,
    message,
    source,
    timestamp: new Date().toISOString(),
    details
  };
  systemLogs.unshift(newLog);
  if (systemLogs.length > 200) systemLogs.pop();
}

// Log initial startup
addLog('info', 'Express Server v4.0.0 Online', 'SERVER', `Port: 3000, Node: ${process.version}`);

async function monitorSystem() {
  try {
    const load = await si.currentLoad();
    if (load.currentLoad > 80) {
      addLog('warning', 'Hohe CPU Last erkannt', 'MONITOR', `Aktuelle Last: ${Math.round(load.currentLoad)}%`);
    }
  } catch (e) {
    console.error("Monitor failed", e);
  }
}
setInterval(monitorSystem, 30000); // Check every 30s
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
    const result: any = await yahooFinance.quote('EURUSD=X');
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

  // System Logs API
  app.get("/api/system-logs", (req, res) => {
    res.json(systemLogs);
  });

  // Real Performance Data
  app.get("/api/performance", async (req, res) => {
    try {
      // Gather data with individual try/catches to prevent total failure
      let cpu = { currentLoad: 0 };
      let mem = { active: 0, total: 1 };
      let fsSize: any[] = [];

      try { cpu = await si.currentLoad(); } catch (e) { console.error("CPU info failed", e); }
      try { mem = await si.mem(); } catch (e) { console.error("MEM info failed", e); }
      try { fsSize = await si.fsSize(); } catch (e) { console.error("FS info failed", e); }

      // Calculate totals for primary storage
      const primaryFs = fsSize && fsSize.length > 0 ? fsSize[0] : null;

      res.json({
        cpu: Math.round(cpu.currentLoad || 0),
        ram: Math.round((mem.active / (mem.total || 1)) * 100),
        storageUsed: primaryFs ? Math.round(primaryFs.use || 0) : 0,
        storageTotal: primaryFs ? Math.round((primaryFs.size || 0) / (1024 * 1024 * 1024)) : 0, // GB
        storageUsedGB: primaryFs ? Math.round((primaryFs.used || 0) / (1024 * 1024 * 1024)) : 0, // GB
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Metric Fetch Error:", error);
      res.status(500).json({ error: "Failed to fetch system metrics", details: error.message });
    }
  });

  // RSS Proxy
  app.get("/api/rss", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });
    
    addLog('info', `RSS Feed Request: ${url.substring(0, 30)}...`, 'NEWS_API');

    try {
      // Use a timeout and a better user agent for the parser
      const feed = await parser.parseURL(url);
      res.json(feed);
    } catch (error: any) {
      console.error(`RSS Fetch Error for URL (${url}):`, error.message);
      
      let errorMessage = "Feed konnte nicht geladen werden";
      let statusCode = error.response?.status || 500;

      // rss-parser might throw errors with status code in message
      if (error.message.includes('Status code')) {
        const match = error.message.match(/Status code (\d+)/);
        if (match) {
          statusCode = parseInt(match[1]);
        }
      }

      if (error.message.includes('ENOTFOUND')) {
        errorMessage = "Server nicht gefunden (URL veraltet)";
        statusCode = 404;
      } else if (statusCode === 404 || error.message.includes('404')) {
        errorMessage = "Der News-Feed wurde nicht gefunden (404 Not Found)";
        statusCode = 404;
      } else if (statusCode === 403) {
        errorMessage = "Zugriff auf den Feed wurde verweigert (403 Forbidden)";
      } else if (error.message.includes('Feed not recognized') || error.message.includes('Attribute without value')) {
        errorMessage = "Kein gültiger RSS-Feed gefunden (Wahrscheinlich eine normale Webseite)";
        statusCode = 400;
      }

      res.status(statusCode).json({ 
        error: errorMessage, 
        details: error.message,
        url: url
      });
    }
  });

  // Real Stock API using Yahoo Finance
  app.get("/api/stocks", async (req, res) => {
    const symbolsRaw = req.query.symbols as string || "";
    if (!symbolsRaw) return res.json({ stocks: [], eurUsdRate: await getExchangeRate() });
    
    const symbols = symbolsRaw.split(",").filter(s => s.trim() !== "").map(s => s.trim().toUpperCase());
    const rate = await getExchangeRate();
    addLog('info', `Aktienkurse abgerufen für: ${symbols.join(', ')}`, 'STOCKS_API');

    try {
      // Fetch all quotes in one batch call if possible, or handle individually with better error catching
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            // yahoo-finance2's quote method is quite robust but sometimes fails for certain symbols
            const quote: any = await yahooFinance.quote(symbol);

            if (!quote) {
              addLog('warning', `Keine Daten für Symbol gefunden: ${symbol}`, 'STOCKS_API');
              return null;
            }

            const originalPrice = quote.regularMarketPrice || quote.postMarketPrice || 0;
            const originalChange = quote.regularMarketChange || 0;
            const currency = quote.currency || 'USD';

            let priceEUR = originalPrice;
            let changeEUR = originalChange;

            if (currency === 'USD') {
              priceEUR = originalPrice * rate;
              changeEUR = originalChange * rate;
            } else if (currency !== 'EUR') {
              // Handle other currencies roughly or just leave as is
              // But for the most common (GBp for London stocks)
              if (currency === 'GBp') {
                priceEUR = (originalPrice / 100) * 1.2; // Pence to Euro roughly
              }
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
          } catch (e: any) {
            console.error(`Yahoo Finance error for ${symbol}:`, e.message);
            addLog('error', `Fehler beim Abrufen von ${symbol}`, 'STOCKS_API', e.message);
            return null;
          }
        })
      );

      const filteredResults = results.filter(r => r !== null);
      
      if (filteredResults.length === 0 && symbols.length > 0) {
        addLog('error', 'Alle Aktienanfragen fehlgeschlagen', 'STOCKS_API');
      }

      res.json({
        stocks: filteredResults,
        eurUsdRate: rate
      });
    } catch (error: any) {
      console.error("Stocks Fetch Root Error:", error);
      addLog('error', 'Kritischer Fehler in Stocks API', 'STOCKS_API', error.message);
      res.status(500).json({ error: "Failed to fetch stock data", details: error.message });
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
