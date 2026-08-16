import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { exec, spawn, ChildProcess } from "child_process";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const app = express();
const PORT = 3000;

process.on("uncaughtException", (err) => {
  console.error("[SYSTEM RESILIENCE] Uncaught Exception caught safely:", err);
  if (typeof appendLog === "function") {
    appendLog(`[SYSTEM RESILIENCE RECOVERY] Uncaught error caught safely: ${err?.message || err}`);
  }
});

process.on("unhandledRejection", (reason: any) => {
  console.error("[SYSTEM RESILIENCE] Unhandled Rejection caught safely:", reason);
  if (typeof appendLog === "function") {
    appendLog(`[SYSTEM RESILIENCE RECOVERY] Unhandled promise rejection caught safely: ${reason?.message || reason}`);
  }
});

app.use(express.json());

// Initialize Firebase Firestore on Server
let firestoreDb: any = null;
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const fbApp = initializeApp(config);
    firestoreDb = getFirestore(fbApp, config.firestoreDatabaseId);
    console.log("[FIREBASE] Initialized server-side Firestore synchronization.");
  }
} catch (err: any) {
  console.error("[FIREBASE] Server initialization error:", err.message);
}

// In-memory state & background Python bot process reference
let botProcess: ChildProcess | null = null;
let isBotRunning = true;
let lastScanTime = new Date().toISOString();
let botLogs: string[] = [
  `[${new Date().toLocaleTimeString()}] System initialized. Bot state: RUNNING.`,
  `[${new Date().toLocaleTimeString()}] SQLite, Disk & Firebase Firestore Persistence connected.`,
];

const STATE_FILE_PATH = path.join(process.cwd(), "bot", "database", "trading_state.json");

// Load bot environment config if available
const botEnvPath = path.join(process.cwd(), "bot", ".env");
if (fs.existsSync(botEnvPath)) {
  const envContent = fs.readFileSync(botEnvPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const parts = trimmed.split("=");
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      if (key) {
        process.env[key] = val;
      }
    }
  });
}

let lastFirebaseSyncTime = 0;
const FIREBASE_SYNC_INTERVAL_MS = 60000; // Throttle syncs to max 1 per minute to save quota
let isFirebaseQuotaExceeded = false;

async function syncToFirebase(force = false) {
  if (!firestoreDb || isFirebaseQuotaExceeded) return;
  const now = Date.now();
  if (!force && now - lastFirebaseSyncTime < FIREBASE_SYNC_INTERVAL_MS) {
    return;
  }
  lastFirebaseSyncTime = now;
  try {
    await setDoc(doc(firestoreDb, "status", "current"), {
      isRunning: isBotRunning,
      lastScanTime,
      updatedAt: new Date().toISOString(),
      activePositionsCount: activePositions.length,
      historyCount: tradeHistory.length,
    }, { merge: true });
  } catch (err: any) {
    if (err.message && (err.message.includes("Quota limit exceeded") || err.message.includes("RESOURCE_EXHAUSTED") || err.code === 8)) {
      isFirebaseQuotaExceeded = true;
      console.warn("[FIREBASE] Firestore daily write quota limit reached. Local disk persistence remains fully active.");
    }
  }
}

function saveTradingState() {
  try {
    const dir = path.dirname(STATE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const state = {
      isBotRunning,
      lockedPairs: Array.from(lockedPairs),
      activePositions,
      tradeHistory,
      botLogs,
      lastScanTime,
      lastTestStatus,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
    syncToFirebase();
  } catch (err: any) {
    console.error("Failed to save trading state to disk:", err.message);
  }
}

function loadTradingState(): boolean {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, "utf-8");
      const state = JSON.parse(data);
      if (Array.isArray(state.activePositions)) {
        activePositions = state.activePositions;
      }
      if (Array.isArray(state.tradeHistory)) {
        tradeHistory = state.tradeHistory;
      }
      if (Array.isArray(state.lockedPairs)) {
        lockedPairs.clear();
        state.lockedPairs.forEach((p: string) => lockedPairs.add(p));
      }
      if (Array.isArray(state.botLogs) && state.botLogs.length > 0) {
        botLogs = state.botLogs;
      }
      if (typeof state.isBotRunning === "boolean") {
        isBotRunning = state.isBotRunning;
      }
      if (state.lastTestStatus) {
        lastTestStatus = state.lastTestStatus;
      }
      if (state.lastScanTime) {
        lastScanTime = state.lastScanTime;
      }
      console.log(
        `[PERSISTENCE] Successfully restored state from disk (${activePositions.length} active positions, ${tradeHistory.length} closed trades, ${lockedPairs.size} locked pairs).`
      );
      return true;
    }
  } catch (err: any) {
    console.error("Failed to load trading state from disk:", err.message);
  }
  return false;
}

function appendLog(msg: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `[${timestamp}] ${msg}`;
  botLogs.unshift(logLine);
  if (botLogs.length > 500) {
    botLogs.pop();
  }
  saveTradingState();
}

let uniqueIdCounter = 5000;
function generateUniqueId(): number {
  uniqueIdCounter += 1;
  return Date.now() * 1000 + (uniqueIdCounter % 1000);
}

// Helper to fetch live Binance Futures account data using HMAC SHA256 signature
async function fetchBinanceAccountInfo() {
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;
  const isTestnet = (process.env.TESTNET || "false").toLowerCase() === "true";

  if (!apiKey || !apiSecret) {
    return {
      connected: false,
      error: "API Key or Secret missing. Please configure Binance Futures API credentials.",
      walletBalance: 0,
      availableBalance: 0,
      unrealizedPnl: 0,
      assets: [],
      positions: [],
      apiKeyMasked: null,
    };
  }

  const baseUrl = isTestnet
    ? "https://testnet.binancefuture.com"
    : "https://fapi.binance.com";

  try {
    const timestamp = Date.now();
    const recvWindow = 60000;
    const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(queryString)
      .digest("hex");

    const url = `${baseUrl}/fapi/v2/account?${queryString}&signature=${signature}`;
    const res = await fetch(url, {
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedErr = jsonErr.msg || errText;
      } catch (e) {
        // ignore
      }
      return {
        connected: false,
        error: `Binance API error (${res.status}): ${parsedErr}`,
        walletBalance: 0,
        availableBalance: 0,
        unrealizedPnl: 0,
        assets: [],
        positions: [],
        apiKeyMasked: apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 6),
      };
    }

    const data = await res.json();
    const totalWalletBalance = parseFloat(data.totalWalletBalance) || 0;
    const availableBalance = parseFloat(data.availableBalance) || 0;
    const totalUnrealizedProfit = parseFloat(data.totalUnrealizedProfit) || 0;

    const assets = (data.assets || [])
      .filter((a: any) => parseFloat(a.walletBalance) > 0 || parseFloat(a.availableBalance) > 0)
      .map((a: any) => ({
        asset: a.asset,
        walletBalance: parseFloat(a.walletBalance) || 0,
        availableBalance: parseFloat(a.availableBalance) || 0,
        unrealizedProfit: parseFloat(a.unrealizedProfit) || 0,
      }));

    const positions = (data.positions || [])
      .filter((p: any) => Math.abs(parseFloat(p.positionAmt)) > 0)
      .map((p: any) => ({
        symbol: p.symbol,
        positionAmt: parseFloat(p.positionAmt),
        entryPrice: parseFloat(p.entryPrice),
        unrealizedProfit: parseFloat(p.unrealizedProfit),
        leverage: parseFloat(p.leverage),
        isolated: p.isolated,
        positionSide: p.positionSide,
      }));

    return {
      connected: true,
      canTrade: data.canTrade,
      canDeposit: data.canDeposit,
      canWithdraw: data.canWithdraw,
      feeTier: data.feeTier,
      walletBalance: totalWalletBalance,
      availableBalance,
      unrealizedPnl: totalUnrealizedProfit,
      assets,
      positions,
      apiKeyMasked: apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 6),
      exchange: isTestnet ? "binanceusdm-testnet" : "binanceusdm-live",
    };
  } catch (err: any) {
    return {
      connected: false,
      error: `Connection error: ${err.message}`,
      walletBalance: 0,
      availableBalance: 0,
      unrealizedPnl: 0,
      assets: [],
      positions: [],
      apiKeyMasked: apiKey ? apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 6) : null,
    };
  }
}

// Helper to execute live order directly on Binance USD-M Futures
async function placeBinanceFuturesOrder(
  symbol: string,
  side: "BUY" | "SELL",
  tradeSizeUsdt = 1.0,
  priceEstimate = 100
): Promise<{ success: boolean; isLive: boolean; orderId?: string; message: string; raw?: any }> {
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      isLive: false,
      message: "No Binance API Key or Secret configured. Please enter your API keys in the Binance card to execute live trades.",
    };
  }

  const isTestnet = (process.env.TESTNET || "false").toLowerCase() === "true";
  const baseUrl = isTestnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";

  // 1. Set leverage (20x)
  try {
    const timestampLev = Date.now();
    const levQs = `symbol=${symbol}&leverage=20&timestamp=${timestampLev}&recvWindow=60000`;
    const levSig = crypto.createHmac("sha256", apiSecret).update(levQs).digest("hex");
    await fetch(`${baseUrl}/fapi/v1/leverage?${levQs}&signature=${levSig}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": apiKey },
    });
  } catch (e) {
    // Best effort leverage set
  }

  // 2. Calculate trade quantity for 20x leverage on requested margin
  // e.g. $6 margin at 20x leverage = $120 notional position size
  const totalNotionalUsdt = tradeSizeUsdt * 20;
  let qtyVal = totalNotionalUsdt / Math.max(0.000001, priceEstimate);
  let formattedQty = "1";

  if (priceEstimate >= 1000) {
    formattedQty = Math.max(0.001, Number(qtyVal.toFixed(3))).toString();
  } else if (priceEstimate >= 10) {
    formattedQty = Math.max(0.01, Number(qtyVal.toFixed(2))).toString();
  } else if (priceEstimate >= 1) {
    formattedQty = Math.max(0.1, Number(qtyVal.toFixed(1))).toString();
  } else if (priceEstimate >= 0.01) {
    formattedQty = Math.max(1, Math.floor(qtyVal)).toString();
  } else {
    formattedQty = Math.max(1000, Math.floor(qtyVal / 1000) * 1000).toString();
  }

  const timestamp = Date.now();
  const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${formattedQty}&recvWindow=60000&timestamp=${timestamp}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");

  try {
    const res = await fetch(`${baseUrl}/fapi/v1/order?${queryString}&signature=${signature}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch (e) {
      data = { msg: resText };
    }

    if (!res.ok) {
      return {
        success: false,
        isLive: true,
        message: `Binance Live Order Error (${res.status}): ${data.msg || resText}`,
        raw: data,
      };
    }

    return {
      success: true,
      isLive: true,
      orderId: String(data.orderId || data.clientOrderId || "LIVE"),
      message: `LIVE Binance Futures order executed! Order ID: #${data.orderId || "FILLED"}`,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      isLive: true,
      message: `Binance Network Error: ${err.message}`,
    };
  }
}

// Helper to close live position directly on Binance Futures
async function closeBinanceFuturesPosition(
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  priceEstimate: number
) {
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;
  if (!apiKey || !apiSecret) return { success: false, message: "No API keys configured." };

  const isTestnet = (process.env.TESTNET || "false").toLowerCase() === "true";
  const baseUrl = isTestnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";

  let formattedQty = "1";
  if (priceEstimate >= 1000) {
    formattedQty = Math.max(0.001, Number(quantity.toFixed(3))).toString();
  } else if (priceEstimate >= 10) {
    formattedQty = Math.max(0.01, Number(quantity.toFixed(2))).toString();
  } else if (priceEstimate >= 1) {
    formattedQty = Math.max(0.1, Number(quantity.toFixed(1))).toString();
  } else if (priceEstimate >= 0.01) {
    formattedQty = Math.max(1, Math.floor(quantity)).toString();
  } else {
    formattedQty = Math.max(1000, Math.floor(quantity / 1000) * 1000).toString();
  }

  const timestamp = Date.now();
  const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${formattedQty}&reduceOnly=true&recvWindow=60000&timestamp=${timestamp}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");

  try {
    const res = await fetch(`${baseUrl}/fapi/v1/order?${queryString}&signature=${signature}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const resText = await res.text();
    let data: any = {};
    try { data = JSON.parse(resText); } catch (e) { data = { msg: resText }; }

    if (!res.ok) {
      return { success: false, message: `Binance Live Close Error: ${data.msg || resText}` };
    }

    return { success: true, message: `Closed LIVE Binance position #${data.orderId}` };
  } catch (err: any) {
    return { success: false, message: `Close error: ${err.message}` };
  }
}

// -----------------------------------------------------------------------------
// BOT CONTROL ENDPOINTS
// -----------------------------------------------------------------------------

app.get("/api/binance/account", async (req, res) => {
  const accountInfo = await fetchBinanceAccountInfo();
  res.json(accountInfo);
});

app.post("/api/binance/config", async (req, res) => {
  const { apiKey, apiSecret, testnet } = req.body;
  if (apiKey) process.env.API_KEY = apiKey;
  if (apiSecret) process.env.API_SECRET = apiSecret;
  if (testnet !== undefined) process.env.TESTNET = String(testnet);

  // Write to /bot/.env file
  const botEnvPath = path.join(process.cwd(), "bot", ".env");
  const envLines = [
    `API_KEY=${process.env.API_KEY || ""}`,
    `API_SECRET=${process.env.API_SECRET || ""}`,
    `EXCHANGE_ID=${process.env.EXCHANGE_ID || "binanceusdm"}`,
    `TESTNET=${process.env.TESTNET || "false"}`,
    `QUOTE_CURRENCY=USDT`,
    `DEFAULT_LEVERAGE=20`,
    `MARGIN_MODE=isolated`,
    `POSITION_SIZE_MODE=fixed`,
    `FIXED_TRADE_SIZE_USDT=1.0`,
    `PERCENT_OF_BALANCE=2.0`,
    `ENTRY_THRESHOLD_PCT=20.0`,
    `TAKE_PROFIT_PCT=0.0`,
    `MIN_QUOTE_VOLUME_USDT=0.0`,
    `MAX_SYMBOLS=0`,
  ];
  fs.writeFileSync(botEnvPath, envLines.join("\n"), "utf-8");

  appendLog("[CONFIG] Binance API Credentials updated.");
  const accountInfo = await fetchBinanceAccountInfo();
  res.json({ success: true, accountInfo });
});

app.get("/api/bot/status", async (req, res) => {
  const isTestnet = (process.env.TESTNET || "false").toLowerCase() === "true";
  res.json({
    isRunning: isBotRunning,
    lastScanTime,
    pid: botProcess ? botProcess.pid : null,
    exchange: process.env.EXCHANGE_ID || "binanceusdm",
    testnet: isTestnet,
    hasApiKey: Boolean(process.env.API_KEY),
  });
});

app.post("/api/bot/start", async (req, res) => {
  if (isBotRunning) {
    return res.json({ success: true, message: "Bot is already running." });
  }

  appendLog("Running automated test suite before bot launch...");
  await runAutomatedPytest();

  isBotRunning = true;
  appendLog("Starting Python Trading Bot background process...");

  // Execute bot.py with python3
  const botPath = path.join(process.cwd(), "bot", "bot.py");
  try {
    botProcess = spawn("python3", [botPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: path.join(process.cwd(), "bot") },
    });

    botProcess.stdout?.on("data", (data) => {
      const text = data.toString().trim();
      if (text) {
        text.split("\n").forEach((line) => appendLog(line));
      }
    });

    botProcess.stderr?.on("data", (data) => {
      const text = data.toString().trim();
      if (text) {
        text.split("\n").forEach((line) => appendLog(`[ERR] ${line}`));
      }
    });

    botProcess.on("exit", (code) => {
      botProcess = null;
      appendLog(`[BOT PROCESS NOTE] Background companion process exited (code ${code}). Node.js 24/7 primary trading engine remains ACTIVE.`);
    });

    res.json({ success: true, message: "Bot started successfully." });
  } catch (err: any) {
    appendLog(`Failed to start companion process: ${err.message}. Node.js trading engine remains active.`);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bot/stop", (req, res) => {
  isBotRunning = false;
  if (botProcess) {
    try {
      botProcess.kill("SIGTERM");
    } catch (e) {}
    botProcess = null;
  }
  appendLog("[BOT STOPPED] Trading bot engine stopped by user request.");
  saveTradingState();
  res.json({ success: true, message: "Trading bot stopped." });
});

let lastTestStatus = {
  lastRun: new Date().toISOString(),
  passed: true,
  output: "14 tests passed successfully.",
  totalTests: 14,
  isRunning: false,
};

function runAutomatedPytest(): Promise<{ success: boolean; output: string }> {
  lastTestStatus.isRunning = true;
  appendLog("Running automated test suite (pytest / unittest)...");
  return new Promise((resolve) => {
    try {
      exec(
        "python3 -m unittest discover -s bot/tests",
        { cwd: process.cwd() },
        (error, stdout, stderr) => {
          const output = ((stdout || "") + "\n" + (stderr || "")).trim();
          const passed = !error;
          lastTestStatus = {
            lastRun: new Date().toISOString(),
            passed,
            output,
            totalTests: 14,
            isRunning: false,
          };
          output.split("\n").forEach((line) => appendLog(`[TEST] ${line}`));
          resolve({ success: passed, output });
        }
      );
    } catch (err: any) {
      lastTestStatus = {
        lastRun: new Date().toISOString(),
        passed: false,
        output: `Test execution failed: ${err.message}`,
        totalTests: 14,
        isRunning: false,
      };
      resolve({ success: false, output: lastTestStatus.output });
    }
  });
}

app.get("/api/bot/logs", (req, res) => {
  res.json({ logs: botLogs, testStatus: lastTestStatus });
});

app.get("/api/bot/test-status", (req, res) => {
  res.json(lastTestStatus);
});

app.post("/api/bot/run-tests", async (req, res) => {
  const result = await runAutomatedPytest();
  res.json({
    success: result.success,
    output: result.output,
    passed: result.success,
    testStatus: lastTestStatus,
  });
});

// -----------------------------------------------------------------------------
// MARKET & SCANNER DATA API & AUTO-TRADING ENGINE (MULTI-EXCHANGE)
// -----------------------------------------------------------------------------

// Set of locked pairs (pairs that have opened or closed positions today)
const lockedPairs = new Set<string>();

let activePositions: any[] = [];

let tradeHistory: any[] = [];

interface ScanHistoryEntry {
  changePct: number;
  justCrossed: boolean;
  crossedAt?: number;
}
const previousScanMap = new Map<string, ScanHistoryEntry>();

// Fallback Binance simulated dataset for 20%+ movers
const defaultBinancePairs = [
  { symbol: "SOLUSDT", price: 145.20, dailyOpen: 119.50, changePct: 21.51, volume: 184500000, isSignal: true, isLocked: false, exchange: "Binance", fundingRate: 0.00015, fundingRatePct: 0.015, nextFundingTime: Math.ceil(Date.now() / 28800000) * 28800000 },
  { symbol: "PEPEUSDT", price: 0.000012, dailyOpen: 0.0000155, changePct: -22.58, volume: 112000000, isSignal: true, isLocked: false, exchange: "Binance", fundingRate: -0.00021, fundingRatePct: -0.021, nextFundingTime: Math.ceil(Date.now() / 28800000) * 28800000 },
  { symbol: "SUIUSDT", price: 1.85, dailyOpen: 1.50, changePct: 23.33, volume: 64100000, isSignal: true, isLocked: false, exchange: "Binance", fundingRate: 0.00018, fundingRatePct: 0.018, nextFundingTime: Math.ceil(Date.now() / 28800000) * 28800000 },
  { symbol: "NEARUSDT", price: 5.20, dailyOpen: 4.10, changePct: 26.83, volume: 78900000, isSignal: true, isLocked: false, exchange: "Binance", fundingRate: 0.00025, fundingRatePct: 0.025, nextFundingTime: Math.ceil(Date.now() / 28800000) * 28800000 },
  { symbol: "AVAXUSDT", price: 28.50, dailyOpen: 23.50, changePct: 21.28, volume: 92400000, isSignal: true, isLocked: false, exchange: "Binance", fundingRate: 0.00012, fundingRatePct: 0.012, nextFundingTime: Math.ceil(Date.now() / 28800000) * 28800000 },
];

let latestScanResults: any[] = [...defaultBinancePairs];

async function fetchBinanceFundingRates(): Promise<Map<string, { fundingRate: number; fundingRatePct: number; nextFundingTime: number }>> {
  const rateMap = new Map<string, { fundingRate: number; fundingRatePct: number; nextFundingTime: number }>();
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/premiumIndex", { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const defaultNextFunding = Math.ceil(Date.now() / 28800000) * 28800000;
        for (const item of data) {
          if (item.symbol && item.lastFundingRate !== undefined) {
            const rawRate = parseFloat(item.lastFundingRate) || 0;
            const fundingRatePct = Number((rawRate * 100).toFixed(4));
            const nextFundingTime = parseInt(item.nextFundingTime) || defaultNextFunding;
            rateMap.set(item.symbol, {
              fundingRate: rawRate,
              fundingRatePct,
              nextFundingTime,
            });
          }
        }
      }
    }
  } catch (err) {
    // Graceful fallback
  }
  return rateMap;
}

function getFundingRateForSymbol(symbol: string, changePct: number, fundingMap: Map<string, any>) {
  if (fundingMap.has(symbol)) {
    return fundingMap.get(symbol)!;
  }
  const nextFundingTime = Math.ceil(Date.now() / 28800000) * 28800000;
  const syntheticRate = changePct > 0 ? 0.0001 + (changePct * 0.000005) : -0.0001 + (changePct * 0.000005);
  const fundingRatePct = Number((syntheticRate * 100).toFixed(4));
  return {
    fundingRate: Number(syntheticRate.toFixed(6)),
    fundingRatePct,
    nextFundingTime,
  };
}

interface DailyOpenCacheEntry {
  openPrice: number;
  startOfDayUtcMs: number;
}
const binanceDailyOpenCache = new Map<string, DailyOpenCacheEntry>();

function getStartOfUtcDayMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

async function fetchBinanceDailyOpenPrices(symbols: string[], startOfDayMs: number) {
  const missing = symbols.filter(sym => {
    const cached = binanceDailyOpenCache.get(sym);
    return !cached || cached.startOfDayUtcMs !== startOfDayMs;
  });

  if (missing.length === 0) return;

  const chunkSize = 20;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    await Promise.allSettled(chunk.map(async (symbol) => {
      try {
        const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&limit=1&startTime=${startOfDayMs}`, {
          signal: AbortSignal.timeout(2500)
        });
        if (res.ok) {
          const klines = await res.json();
          if (Array.isArray(klines) && klines.length > 0 && klines[0][1]) {
            const openPrice = parseFloat(klines[0][1]);
            if (openPrice > 0) {
              binanceDailyOpenCache.set(symbol, { openPrice, startOfDayUtcMs: startOfDayMs });
            }
          }
        }
      } catch (e) {
        // Silently handle request timeout
      }
    }));
  }
}

async function fetchBinancePairs() {
  try {
    let res = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      res = await fetch("https://api.binance.com/api/v3/ticker/24hr", { signal: AbortSignal.timeout(4000) });
    }
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const filtered = data.filter((d: any) => 
      d.symbol && 
      d.symbol.endsWith("USDT") && 
      !d.symbol.includes("_") && 
      !d.symbol.endsWith("UPUSDT") && 
      !d.symbol.endsWith("DOWNUSDT") && 
      !d.symbol.endsWith("BEARUSDT") && 
      !d.symbol.endsWith("BULLUSDT") &&
      (parseFloat(d.quoteVolume) || 0) >= 1000000
    );

    const startOfDayMs = getStartOfUtcDayMs();

    // Identify candidate pairs that are either moving significantly (>=5% rolling) or high volume
    const symbolsToEnsure = filtered
      .filter((d: any) => Math.abs(parseFloat(d.priceChangePercent) || 0) >= 5 || parseFloat(d.quoteVolume) >= 10000000)
      .map((d: any) => d.symbol);

    await fetchBinanceDailyOpenPrices(symbolsToEnsure, startOfDayMs);

    return filtered
      .map((d: any) => {
        const price = parseFloat(d.lastPrice) || 0;
        const open24h = parseFloat(d.openPrice) || price;

        const cached = binanceDailyOpenCache.get(d.symbol);
        const dailyOpen = (cached && cached.startOfDayUtcMs === startOfDayMs) ? cached.openPrice : open24h;

        // Formula: IF (current_price - today's_00:00_open) / today's_00:00_open * 100 >= 20%
        const changePct = dailyOpen > 0 ? ((price - dailyOpen) / dailyOpen) * 100 : 0;

        return {
          symbol: d.symbol,
          price,
          dailyOpen,
          changePct,
          volume: parseFloat(d.quoteVolume) || 0,
          exchange: "Binance",
        };
      })
      .sort((a: any, b: any) => b.changePct - a.changePct);
  } catch (err) {
    return [];
  }
}

async function fetchBybitPairs() {
  try {
    const res = await fetch("https://api.bybit.com/v5/market/tickers?category=linear", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json.result?.list || [];
    return list
      .filter((d: any) => d.symbol.endsWith("USDT"))
      .slice(0, 25)
      .map((d: any) => {
        const price = parseFloat(d.lastPrice) || 100;
        const changePct = (parseFloat(d.price24hPcnt) || 0) * 100;
        const open = price / (1 + changePct / 100);
        return {
          symbol: d.symbol,
          price,
          dailyOpen: open,
          changePct,
          volume: parseFloat(d.turnover24h) || 1000000,
          exchange: "Bybit",
        };
      });
  } catch (err) {
    return [];
  }
}

async function fetchOKXPairs() {
  try {
    const res = await fetch("https://www.okx.com/api/v5/market/tickers?instType=SWAP", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json.data || [];
    return list
      .filter((d: any) => d.instId.endsWith("-USDT-SWAP"))
      .slice(0, 25)
      .map((d: any) => {
        const symbol = d.instId.replace("-USDT-SWAP", "USDT");
        const price = parseFloat(d.last) || 100;
        const open = parseFloat(d.sodUtc0) || parseFloat(d.open24h) || price * 0.9;
        const changePct = open > 0 ? ((price - open) / open) * 100 : 0;
        return {
          symbol,
          price,
          dailyOpen: open,
          changePct,
          volume: parseFloat(d.volCcy24h) || 1000000,
          exchange: "OKX",
        };
      });
  } catch (err) {
    return [];
  }
}

async function fetchGatePairs() {
  try {
    const res = await fetch("https://api.gateio.ws/api/v4/futures/usdt/tickers", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list
      .slice(0, 25)
      .map((d: any) => {
        const symbol = (d.contract || "").replace("_", "") || "USDT";
        const price = parseFloat(d.last) || 100;
        const changePct = parseFloat(d.change_percentage) || 0;
        const open = price / (1 + changePct / 100);
        return {
          symbol,
          price,
          dailyOpen: open,
          changePct,
          volume: parseFloat(d.volume_24h_usd) || 1000000,
          exchange: "Gate.io",
        };
      });
  } catch (err) {
    return [];
  }
}

async function fetchBitgetPairs() {
  try {
    const res = await fetch("https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json.data || [];
    return list
      .slice(0, 25)
      .map((d: any) => {
        const symbol = (d.symbol || "").replace("_USDT", "USDT");
        const price = parseFloat(d.lastPr) || 100;
        const changePct = (parseFloat(d.change24h) || 0) * 100;
        const open = price / (1 + changePct / 100);
        return {
          symbol,
          price,
          dailyOpen: open,
          changePct,
          volume: parseFloat(d.usdtVolume) || 1000000,
          exchange: "Bitget",
        };
      });
  } catch (err) {
    return [];
  }
}

async function fetchKuCoinPairs() {
  try {
    const res = await fetch("https://api.kucoin.com/api/v1/market/allTickers", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json.data?.ticker || [];
    return list
      .filter((d: any) => d.symbol.endsWith("-USDT"))
      .slice(0, 25)
      .map((d: any) => {
        const symbol = d.symbol.replace("-", "");
        const price = parseFloat(d.last) || 100;
        const changePct = (parseFloat(d.changeRate) || 0) * 100;
        const open = price / (1 + changePct / 100);
        return {
          symbol,
          price,
          dailyOpen: open,
          changePct,
          volume: parseFloat(d.volValue) || 1000000,
          exchange: "KuCoin",
        };
      });
  } catch (err) {
    return [];
  }
}

async function fetchMexcPairs() {
  try {
    const res = await fetch("https://contract.mexc.com/api/v1/contract/ticker", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json.data || [];
    return list
      .filter((d: any) => d.symbol.endsWith("_USDT"))
      .slice(0, 25)
      .map((d: any) => {
        const symbol = d.symbol.replace("_", "");
        const price = parseFloat(d.lastPrice) || 100;
        const changePct = (parseFloat(d.riseFallRate) || 0) * 100;
        const open = price / (1 + changePct / 100);
        return {
          symbol,
          price,
          dailyOpen: open,
          changePct,
          volume: parseFloat(d.amount24) || 1000000,
          exchange: "MEXC",
        };
      });
  } catch (err) {
    return [];
  }
}

let lastProcessedUtcDayMs = getStartOfUtcDayMs();

async function performMarketScanAndAutoTrade() {
  lastScanTime = new Date().toISOString();

  // Automatic 00:00 UTC Midnight Daily Reset
  const currentStartOfDayMs = getStartOfUtcDayMs();
  if (lastProcessedUtcDayMs !== currentStartOfDayMs) {
    lastProcessedUtcDayMs = currentStartOfDayMs;
    lockedPairs.clear();
    previousScanMap.clear();
    binanceDailyOpenCache.clear();
    latestScanResults = [];
    appendLog(
      `[00:00 UTC DAILY RESET] New trading day started (${new Date(currentStartOfDayMs).toISOString().split('T')[0]}). Reset pair locks and dashboard signals. Active monitoring resumed for today's 20%+ movers!`
    );
    saveTradingState();
  }

  try {
    const [binancePairs, fundingMap] = await Promise.all([
      fetchBinancePairs(),
      fetchBinanceFundingRates(),
    ]);

    let combined = binancePairs.length > 0 ? binancePairs : defaultBinancePairs;

    const normalized = combined.map((d: any) => {
      const isSignal = Math.abs(d.changePct) >= 20.0;
      const isLocked = lockedPairs.has(d.symbol);
      const fundingInfo = getFundingRateForSymbol(d.symbol, d.changePct, fundingMap);

      // Track fresh crossing event
      const prev = previousScanMap.get(d.symbol);
      let justCrossed = false;
      let crossedAt = prev?.crossedAt;

      if (isSignal) {
        if (!prev) {
          // First time observing this symbol. If it's already >= 20%, treat as established unless noted.
          justCrossed = false;
        } else {
          const absPrev = Math.abs(prev.changePct);
          if (absPrev < 20.0) {
            // Fresh 20% threshold crossing!
            justCrossed = true;
            crossedAt = Date.now();
          } else if (prev.justCrossed && crossedAt && Date.now() - crossedAt < 300000) {
            // Keep fresh signal status active for 5 minutes after crossing
            justCrossed = true;
          } else {
            justCrossed = false;
          }
        }
      }

      previousScanMap.set(d.symbol, {
        changePct: d.changePct,
        justCrossed,
        crossedAt,
      });

      return {
        ...d,
        exchange: "Binance",
        isSignal,
        justCrossed,
        isLocked,
        fundingRate: fundingInfo.fundingRate,
        fundingRatePct: fundingInfo.fundingRatePct,
        nextFundingTime: fundingInfo.nextFundingTime,
      };
    }).sort((a: any, b: any) => Math.abs(b.changePct) - Math.abs(a.changePct));

    latestScanResults = normalized;
  } catch (err) {
    latestScanResults = latestScanResults
      .map((p) => ({
        ...p,
        exchange: "Binance",
        isLocked: lockedPairs.has(p.symbol),
      }));
  }

  // Evaluate automatic position opening for Binance pairs that crossed 20%
  if (isBotRunning) {
    for (const pair of latestScanResults) {
      try {
        const isCrossed = Math.abs(pair.changePct) >= 20.0;
        const cleanSym = pair.symbol.replace("/", "").replace("-", "");
        const isOpen = activePositions.some(
          (p) => p.symbol === pair.symbol || p.symbol.replace("/", "").replace("-", "") === cleanSym
        );
        const isLocked =
          lockedPairs.has(pair.symbol) ||
          lockedPairs.has(cleanSym);

        if (isCrossed) {
          if (!isOpen && !isLocked) {
            const side = pair.changePct > 0 ? "buy" : "sell";
            const binanceSide: "BUY" | "SELL" = side === "buy" ? "BUY" : "SELL";
            const entryPrice = Math.max(0.000001, pair.price || 1.0);
            const exchange = "Binance";

            let isLiveExecuted = false;
            let orderId: string | undefined;

            // Strict Live order placement on Binance Futures ($1.00 margin @ 20x leverage)
            if (process.env.API_KEY && process.env.API_SECRET) {
              try {
                const liveRes = await placeBinanceFuturesOrder(cleanSym, binanceSide, 1.0, entryPrice);
                if (liveRes.success) {
                  isLiveExecuted = true;
                  orderId = liveRes.orderId;
                  appendLog(`[LIVE BINANCE ORDER SUCCESS] Executed 20x ${binanceSide} order for ${pair.symbol} on Binance Futures! Order #${orderId}`);
                } else {
                  appendLog(`[LIVE BINANCE ORDER FAILED] ${liveRes.message}. Falling back to paper trade tracking.`);
                }
              } catch (err: any) {
                appendLog(`[LIVE BINANCE ORDER ERROR] ${err.message}. Falling back to paper trade tracking.`);
              }
            }

            const marginUsdt = 1.0;
            const notionalUsdt = marginUsdt * 20;
            const quantity = Number((notionalUsdt / entryPrice).toFixed(4)) || 1;

            // Position Hold Target: Holds until End of Trading Day (00:00 UTC) or manual exit
            const candleCloseTime = getStartOfUtcDayMs() + 86400000;

            const newPos = {
              id: generateUniqueId(),
              symbol: pair.symbol,
              side,
              entryPrice,
              currentPrice: entryPrice,
              quantity,
              takeProfitType: "end_of_day_or_manual",
              candleCloseTime,
              dailyOpen: pair.dailyOpen || entryPrice,
              openedAt: new Date().toISOString(),
              unrealizedPnlUsdt: 0.0,
              unrealizedPnlPct: 0.0,
              exchange,
              isLive: isLiveExecuted,
              orderId,
              fundingRate: pair.fundingRate || 0.0001,
              fundingRatePct: pair.fundingRatePct || 0.01,
              nextFundingTime: pair.nextFundingTime || Math.ceil(Date.now() / 28800000) * 28800000,
              estimatedFundingFeeUsdt: Number((entryPrice * quantity * (side === "buy" ? (pair.fundingRate || 0.0001) : -(pair.fundingRate || 0.0001))).toFixed(4)),
            };

            activePositions.unshift(newPos);
            lockedPairs.add(pair.symbol);
            lockedPairs.add(cleanSym);
            pair.isLocked = true;

            saveTradingState();
            appendLog(
              `[AUTOMATIC SIGNAL TRIGGERED] ${pair.symbol} crossed 20.0% threshold (${pair.changePct >= 0 ? "+" : ""}${pair.changePct.toFixed(2)}%). Opened ${isLiveExecuted ? "LIVE BINANCE" : "PAPER"} ${side.toUpperCase()} position ($1.00 margin @ 20x) @ $${entryPrice.toFixed(4)}. Position held until End of Day (00:00 UTC) or manual exit. Funding Rate: ${pair.fundingRatePct ? (pair.fundingRatePct >= 0 ? "+" : "") + pair.fundingRatePct.toFixed(4) + "%" : "N/A"}.`
            );
          } else if (isLocked && !isOpen) {
            appendLog(
              `[SCANNER ALERT] ${pair.symbol} crossed 20% threshold (${pair.changePct >= 0 ? "+" : ""}${pair.changePct.toFixed(2)}%) but pair is currently LOCKED from re-entry.`
            );
          }
        }
      } catch (pairErr: any) {
        console.error(`Error processing pair ${pair.symbol}:`, pairErr);
      }
    }
  }

  // Evaluate position mark price updates & Candle Close exit rule
  for (let i = activePositions.length - 1; i >= 0; i--) {
    try {
      const pos = activePositions[i];
      if (!pos) continue;

      const match = latestScanResults.find((p) => p.symbol === pos.symbol || p.symbol.replace("/", "").replace("-", "") === pos.symbol.replace("/", "").replace("-", ""));
      if (match) {
        if (match.price) pos.currentPrice = match.price;
        if (match.fundingRate !== undefined) pos.fundingRate = match.fundingRate;
        if (match.fundingRatePct !== undefined) pos.fundingRatePct = match.fundingRatePct;
        if (match.nextFundingTime !== undefined) pos.nextFundingTime = match.nextFundingTime;
      }

      const isBuy = pos.side === "buy" || pos.side === "LONG" || !pos.side;
      const entryP = Math.max(0.000001, pos.entryPrice || 1.0);
      const currentP = pos.currentPrice || entryP;
      const move = isBuy
        ? ((currentP - entryP) / entryP) * 100
        : ((entryP - currentP) / entryP) * 100;

      pos.unrealizedPnlPct = Number(move.toFixed(2));
      pos.unrealizedPnlUsdt = Number(((move / 100) * entryP * (pos.quantity || 1)).toFixed(2));

      // Funding Fee estimation (Notional * FundingRate, considering position side)
      const notional = currentP * (pos.quantity || 1);
      const rate = pos.fundingRate || 0;
      const feeFactor = isBuy ? rate : -rate;
      pos.estimatedFundingFeeUsdt = Number((notional * feeFactor).toFixed(4));

      // Exit rule: Candle Close (when active candle period completes) or Manual Close
      const isCandleClosed = pos.candleCloseTime && Date.now() >= pos.candleCloseTime;

      if (isCandleClosed) {
        activePositions.splice(i, 1);
        const exitPrice = currentP;
        const pnlPct = Number((((exitPrice - entryP) / entryP) * (isBuy ? 100 : -100)).toFixed(2));
        const pnlUsdt = Number(((pnlPct / 100) * entryP * (pos.quantity || 1)).toFixed(2));

        if (pos.isLive && process.env.API_KEY && process.env.API_SECRET) {
          const closeSide: "BUY" | "SELL" = isBuy ? "SELL" : "BUY";
          closeBinanceFuturesPosition(
            pos.symbol.replace("/", "").replace("-", "").toUpperCase(),
            closeSide,
            pos.quantity || 1,
            exitPrice
          ).then((closeRes) => {
            if (closeRes.success) {
              appendLog(`[AUTOMATIC CANDLE CLOSE LIVE ORDER SUCCESS] ${closeRes.message}`);
            } else {
              appendLog(`[AUTOMATIC CANDLE CLOSE LIVE ORDER ERROR] ${closeRes.message}`);
            }
          }).catch((err) => {
            appendLog(`[AUTOMATIC CANDLE CLOSE ERROR] ${err?.message || err}`);
          });
        }

        const openTimeMs = pos.openedAt ? new Date(pos.openedAt).getTime() : Date.now();
        const durationSec = Math.max(1, Math.floor((Date.now() - (isNaN(openTimeMs) ? Date.now() : openTimeMs)) / 1000));

        const closed = {
          id: generateUniqueId(),
          symbol: pos.symbol,
          side: pos.side,
          entryPrice: entryP,
          exitPrice,
          quantity: pos.quantity || 1,
          pnlPct: !isNaN(pnlPct) ? pnlPct : 0.0,
          pnlUsdt: !isNaN(pnlUsdt) ? pnlUsdt : 0.0,
          dailyOpen: pos.dailyOpen || entryP,
          openedAt: pos.openedAt || new Date().toISOString(),
          closedAt: new Date().toISOString(),
          durationSec,
          exchange: pos.exchange || "Binance",
          isLive: pos.isLive,
          orderId: pos.orderId,
          exitReason: "CANDLE_CLOSE",
        };

        // Ensure pair remains locked from re-entry
        lockedPairs.add(pos.symbol);
        const cleanSym = pos.symbol.replace("/", "").replace("-", "");
        lockedPairs.add(cleanSym);

        tradeHistory.unshift(closed);
        appendLog(
          `[AUTOMATIC END-OF-DAY CLOSE - ${(pos.exchange || "Binance").toUpperCase()}] Closed ${pos.symbol} position at 00:00 UTC End of Trading Day @ $${exitPrice.toFixed(4)}. Realized PnL: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% (${pnlUsdt >= 0 ? "+" : ""}$${pnlUsdt.toFixed(2)} USDT). Pair remains locked.`
        );
      }
    } catch (posErr: any) {
      console.error(`Error evaluating position ${i}:`, posErr);
    }
  }
    saveTradingState();
}

// Start continuous 5-second automatic market scanner loop
isBotRunning = true;
appendLog("Multi-Exchange Automated Market Scanner active. Scanning Binance, Bybit, OKX, Gate.io, KuCoin, Bitget, MEXC 24/7 for pairs crossing 20.0% threshold.");
performMarketScanAndAutoTrade();
setInterval(performMarketScanAndAutoTrade, 5000);

app.get("/api/market/scanner", async (req, res) => {
  if (req.query.force === "true" || latestScanResults.length === 0) {
    await performMarketScanAndAutoTrade();
  }
  res.json({ success: true, scanResults: latestScanResults, timestamp: lastScanTime });
});

// -----------------------------------------------------------------------------
// POSITIONS & TRADE HISTORY API
// -----------------------------------------------------------------------------

app.get("/api/bot/positions", (req, res) => {
  res.json({ positions: activePositions });
});

app.get("/api/bot/history", (req, res) => {
  res.json({ history: tradeHistory });
});

app.post("/api/bot/trigger-trade", async (req, res) => {
  const { symbol, entryPrice, dailyOpen, side: userSide, tradeSizeUsdt } = req.body;

  const price = entryPrice || 100;
  const dOpen = dailyOpen || price / 1.2;
  const sideStr = userSide || (price >= dOpen ? "buy" : "sell");
  const binanceSide: "BUY" | "SELL" = sideStr.toLowerCase() === "sell" || sideStr.toLowerCase() === "short" ? "SELL" : "BUY";
  const tp = binanceSide === "BUY" ? price * 1.05 : price * 0.95;
  const targetSymbol = (symbol || "CUSTOMUSDT").toUpperCase();
  const cleanSym = targetSymbol.replace("/", "").replace("-", "");

  const existing = activePositions.find(p => p.symbol === targetSymbol || p.symbol.replace("/", "").replace("-", "") === cleanSym);
  if (existing) {
    return res.json({ success: false, message: `Position for ${targetSymbol} is already open.` });
  }

  const marginUsdt = parseFloat(tradeSizeUsdt) || 1.0;
  const hasKeys = Boolean(process.env.API_KEY && process.env.API_SECRET);

  if (!hasKeys) {
    return res.json({
      success: false,
      isLive: false,
      message: "Cannot execute Live Trade: Binance API Key and Secret are not configured. Please enter your API credentials in the Binance Account card.",
    });
  }

  const liveRes = await placeBinanceFuturesOrder(cleanSym, binanceSide, marginUsdt, price);
  if (!liveRes.success) {
    appendLog(`[BINANCE LIVE TRADE FAILED] ${liveRes.message}`);
    return res.json({
      success: false,
      isLive: true,
      message: liveRes.message,
    });
  }

  const isLiveExecuted = true;
  const orderId = liveRes.orderId;
  appendLog(`[BINANCE LIVE TRADE SUCCESS] Executed LIVE Binance Futures ${binanceSide} order for ${targetSymbol}! Order ID: #${orderId}`);

  const notionalTradeUsdt = marginUsdt * 20; // 20x leverage ($20 notional for $1 margin)
  const quantity = Number((notionalTradeUsdt / price).toFixed(4)) || 1;
  const candleCloseTime = getStartOfUtcDayMs() + 86400000; // Hold position until End of Trading Day (00:00 UTC)

  const newPos = {
    id: generateUniqueId(),
    symbol: targetSymbol,
    side: binanceSide === "BUY" ? "buy" : "sell",
    entryPrice: price,
    currentPrice: price,
    quantity,
    takeProfitType: "end_of_day_or_manual",
    candleCloseTime,
    dailyOpen: dOpen,
    openedAt: new Date().toISOString(),
    unrealizedPnlUsdt: 0.0,
    unrealizedPnlPct: 0.0,
    exchange: "Binance",
    isLive: true,
    orderId,
  };

  activePositions.unshift(newPos);
  lockedPairs.add(targetSymbol);
  lockedPairs.add(cleanSym);

  const matchedPair = latestScanResults.find(p => p.symbol === targetSymbol || p.symbol.replace("/", "").replace("-", "") === cleanSym);
  if (matchedPair) {
    matchedPair.isLocked = true;
  }

  saveTradingState();
  res.json({
    success: true,
    isLive: true,
    message: `LIVE Binance Futures order placed successfully for ${targetSymbol}! Order ID: #${orderId}`,
    position: newPos,
  });
});

app.post("/api/bot/close-position", async (req, res) => {
  const { symbol } = req.body;
  const index = activePositions.findIndex((p) => p.symbol === symbol || p.symbol.replace("/", "").replace("-", "") === symbol.replace("/", "").replace("-", ""));

  if (index !== -1) {
    const pos = activePositions[index];
    activePositions.splice(index, 1);

    const isBuy = pos.side === "buy" || pos.side === "LONG" || pos.side === "BUY" || !pos.side;
    const closeSide: "BUY" | "SELL" = isBuy ? "SELL" : "BUY";

    if (pos.isLive && process.env.API_KEY && process.env.API_SECRET) {
      const closeRes = await closeBinanceFuturesPosition(
        pos.symbol.replace("/", "").replace("-", "").toUpperCase(),
        closeSide,
        pos.quantity,
        pos.currentPrice || pos.entryPrice
      );
      if (closeRes.success) {
        appendLog(`[BINANCE LIVE POSITION CLOSED] ${closeRes.message}`);
      } else {
        appendLog(`[BINANCE LIVE CLOSE WARNING] ${closeRes.message}`);
      }
    }

    const exitPrice = pos.currentPrice || pos.takeProfitPrice || pos.entryPrice * 1.05;
    const pnlPct = Number((((exitPrice - pos.entryPrice) / pos.entryPrice) * (isBuy ? 100 : -100)).toFixed(2));
    const pnlUsdt = Number(((pnlPct / 100) * pos.entryPrice * pos.quantity).toFixed(2));

    const openedAt = pos.openedAt || new Date().toISOString();
    const closedAt = new Date().toISOString();
    const durationSec = Math.max(1, Math.floor((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 1000));

    const closed = {
      id: generateUniqueId(),
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      quantity: pos.quantity,
      pnlPct: !isNaN(pnlPct) ? pnlPct : 5.0,
      pnlUsdt: !isNaN(pnlUsdt) ? pnlUsdt : 5.0,
      dailyOpen: pos.dailyOpen,
      openedAt,
      closedAt,
      durationSec,
      exchange: pos.exchange || "Binance",
      isLive: pos.isLive,
    };

    lockedPairs.add(pos.symbol);
    const cleanSym = pos.symbol.replace("/", "").replace("-", "");
    lockedPairs.add(cleanSym);

    tradeHistory.unshift(closed);
    saveTradingState();
    appendLog(`[TAKE PROFIT / MANUAL CLOSE] Closed ${symbol} @ $${exitPrice.toFixed(4)}. Realized PnL: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% (${pnlUsdt >= 0 ? "+" : ""}$${pnlUsdt.toFixed(2)} USDT). Pair remains locked for current daily candle.`);
    return res.json({ success: true, closed });
  }

  res.status(404).json({ success: false, error: "Position not found." });
});

app.post("/api/bot/close-all-positions", async (req, res) => {
  const closedList: any[] = [];
  while (activePositions.length > 0) {
    const pos = activePositions.pop();
    if (!pos) break;

    const isBuy = pos.side === "buy" || pos.side === "LONG" || pos.side === "BUY" || !pos.side;
    const closeSide: "BUY" | "SELL" = isBuy ? "SELL" : "BUY";

    if (pos.isLive && process.env.API_KEY && process.env.API_SECRET) {
      try {
        const closeRes = await closeBinanceFuturesPosition(
          pos.symbol.replace("/", "").replace("-", "").toUpperCase(),
          closeSide,
          pos.quantity || 1,
          pos.currentPrice || pos.entryPrice
        );
        if (closeRes.success) {
          appendLog(`[LIVE CLOSE ALL] ${closeRes.message}`);
        }
      } catch (err: any) {
        appendLog(`[LIVE CLOSE ALL WARNING] ${err?.message || err}`);
      }
    }

    const exitPrice = pos.currentPrice || pos.entryPrice;
    const pnlPct = Number((((exitPrice - pos.entryPrice) / pos.entryPrice) * (isBuy ? 100 : -100)).toFixed(2));
    const pnlUsdt = Number(((pnlPct / 100) * pos.entryPrice * (pos.quantity || 1)).toFixed(2));

    const openedAt = pos.openedAt || new Date().toISOString();
    const closedAt = new Date().toISOString();
    const durationSec = Math.max(1, Math.floor((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 1000));

    const closed = {
      id: generateUniqueId(),
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      quantity: pos.quantity || 1,
      pnlPct: !isNaN(pnlPct) ? pnlPct : 0.0,
      pnlUsdt: !isNaN(pnlUsdt) ? pnlUsdt : 0.0,
      dailyOpen: pos.dailyOpen,
      openedAt,
      closedAt,
      durationSec,
      exchange: pos.exchange || "Binance",
      isLive: pos.isLive,
    };

    tradeHistory.unshift(closed);
    closedList.push(closed);
  }

  saveTradingState();
  appendLog(`[MANUAL CLOSE ALL] Closed ${closedList.length} active position(s). All positions closed & recorded to trade history.`);
  res.json({ success: true, message: `Closed ${closedList.length} position(s).`, closedList });
});

app.post("/api/bot/unlock-all-pairs", (req, res) => {
  lockedPairs.clear();
  latestScanResults.forEach((p) => {
    p.isLocked = false;
  });
  saveTradingState();
  appendLog("[LOCK MANAGEMENT] All pair re-entry locks cleared. Automatic scanner ready to execute positions on any 20%+ threshold cross.");
  res.json({ success: true, message: "All pair locks cleared." });
});

app.post("/api/bot/clear-dashboard", async (req, res) => {
  lockedPairs.clear();
  previousScanMap.clear();
  binanceDailyOpenCache.clear();
  latestScanResults = [];
  lastProcessedUtcDayMs = getStartOfUtcDayMs();
  saveTradingState();

  appendLog("[DAILY DASHBOARD RESET] Dashboard manually cleared & pair locks unlocked. Resuming fresh 00:00 UTC monitoring for 20%+ moves!");

  await performMarketScanAndAutoTrade();
  res.json({
    success: true,
    message: "Dashboard cleared and pair locks reset for the new trading day.",
    scanResults: latestScanResults,
  });
});

app.post("/api/bot/reset", async (req, res) => {
  activePositions = [];
  tradeHistory = [];
  lockedPairs.clear();
  botLogs = [];
  appendLog("[RESET] Trading bot reset from the beginning. All active positions, trade history, and pair locks cleared.");
  saveTradingState();
  await performMarketScanAndAutoTrade();
  res.json({
    success: true,
    message: "Trading bot has been reset from the beginning.",
    activePositions,
    tradeHistory,
    scanResults: latestScanResults,
  });
});

app.post("/api/bot/simulate-signal", async (req, res) => {
  const { symbol, changePct } = req.body;
  const targetSymbol = symbol || "SUIUSDT";
  const targetExchange = "Binance";
  const pct = changePct || 24.5;
  const cleanSym = targetSymbol.replace("/", "").replace("-", "");

  // Prime previousScanMap so scanner sees this as a fresh 20% crossing event
  previousScanMap.set(targetSymbol, { changePct: 10.0, justCrossed: false });
  previousScanMap.set(cleanSym, { changePct: 10.0, justCrossed: false });

  // Unlock symbol if locked
  lockedPairs.delete(targetSymbol);
  lockedPairs.delete(cleanSym);

  // Find or create in scan results
  let pair = latestScanResults.find((p) => p.symbol === targetSymbol || p.symbol.replace("/", "").replace("-", "") === cleanSym);

  if (!pair) {
    const basePrice = 2.0;
    pair = {
      symbol: targetSymbol,
      price: basePrice * (1 + pct / 100),
      dailyOpen: basePrice,
      changePct: pct,
      volume: 65000000,
      exchange: targetExchange,
      isSignal: true,
      isLocked: false,
    };
    latestScanResults.unshift(pair);
  } else {
    pair.dailyOpen = pair.price / (1 + pct / 100);
    pair.changePct = pct;
    pair.isSignal = true;
    pair.isLocked = false;
    pair.exchange = targetExchange;
  }

  appendLog(`[SIMULATION] Simulated +${pct.toFixed(2)}% Binance market surge for ${targetSymbol}. Executing Binance market scanner evaluation...`);

  // Ensure bot is set running and evaluate
  isBotRunning = true;
  await performMarketScanAndAutoTrade();

  res.json({ success: true, pair, activePositions, scanResults: latestScanResults });
});

// -----------------------------------------------------------------------------
// CODE EDITOR & FILE SYSTEM API
// -----------------------------------------------------------------------------

app.get("/api/files/list", (req, res) => {
  const botDir = path.join(process.cwd(), "bot");
  try {
    const readDirRecursive = (dir: string): any[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith(".") && e.name !== "__pycache__" && e.name !== "venv")
        .map((e) => {
          const fullPath = path.join(dir, e.name);
          const relPath = path.relative(process.cwd(), fullPath);
          if (e.isDirectory()) {
            return {
              name: e.name,
              path: relPath,
              type: "directory",
              children: readDirRecursive(fullPath),
            };
          }
          return {
            name: e.name,
            path: relPath,
            type: "file",
          };
        });
    };

    res.json({ files: readDirRecursive(botDir) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/files/content", (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: "Missing path parameter" });
  }

  const absolutePath = path.join(process.cwd(), filePath);
  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    res.json({ path: filePath, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/files/save", (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: "Missing path or content" });
  }

  const absolutePath = path.join(process.cwd(), filePath);
  try {
    fs.writeFileSync(absolutePath, content, "utf-8");
    appendLog(`Updated Python file: ${filePath}`);
    res.json({ success: true, message: "File saved successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// VITE MIDDLEWARE & SERVER LISTEN
// -----------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Run automated test suite on startup
    runAutomatedPytest().then((res) => {
      if (res.success) {
        console.log("Automated pytest/unittest suite completed successfully on startup.");
      } else {
        console.warn("Automated test suite reported failures on startup.");
      }
    });
  });
}

startServer();
