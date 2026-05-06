import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import Parser from "rss-parser";
import dotenv from "dotenv";
import si from "systeminformation";

dotenv.config();

const parser = new Parser();

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

  // Mock Stock API (Replace with real API like Finnhub or Alpha Vantage in production)
  app.get("/api/stocks", async (req, res) => {
    const symbols = (req.query.symbols as string || "").split(",");
    
    // In a real app, you'd fetch from an external API here
    // For this dashboard, we'll return some realistic-looking data
    const mockData = symbols.map(symbol => {
      const basePrice = symbol.charCodeAt(0) * 10;
      const change = (Math.random() - 0.5) * 5;
      return {
        symbol: symbol.toUpperCase(),
        price: (basePrice + change).toFixed(2),
        change: change.toFixed(2),
        changePercent: ((change / basePrice) * 100).toFixed(2),
        updatedAt: new Date().toISOString()
      };
    });

    res.json(mockData);
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
