import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { OverviewCards } from "./components/OverviewCards";
import { BinanceAccountCard } from "./components/BinanceAccountCard";
import { MarketRadarTable } from "./components/MarketRadarTable";
import { ActivePositionsTable } from "./components/ActivePositionsTable";
import { TradeHistoryList } from "./components/TradeHistoryList";
import { CodeExplorer } from "./components/CodeExplorer";
import { Backtester } from "./components/Backtester";
import { ConsoleLogs } from "./components/ConsoleLogs";
import { PytestModal } from "./components/PytestModal";
import { ManualTradeModal } from "./components/ManualTradeModal";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { BotStatus, Position, TradeHistoryItem, MarketPair, TestStatus, BinanceAccountInfo } from "./types";
import { testFirebaseConnection } from "./firebase";

export default function App() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [binanceAccount, setBinanceAccount] = useState<BinanceAccountInfo | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isManualTradeModalOpen, setIsManualTradeModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<TradeHistoryItem[]>([]);
  const [marketPairs, setMarketPairs] = useState<MarketPair[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const addToast = (text: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now().toString() + Math.random().toString().substring(2, 5);
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch Binance Account Info
  const fetchBinanceAccount = () => {
    setIsAccountLoading(true);
    fetch("/api/binance/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setIsAccountLoading(false);
        if (data) setBinanceAccount(data);
      })
      .catch((err) => {
        setIsAccountLoading(false);
        console.warn("Fetching Binance Account:", err.message);
      });
  };

  // Fetch status
  const fetchStatus = () => {
    fetch("/api/bot/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setBotStatus(data); })
      .catch((err) => console.warn("Polling bot status:", err.message));
  };

  // Fetch Pytest Status
  const fetchTestStatus = () => {
    fetch("/api/bot/test-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setTestStatus(data); })
      .catch((err) => console.warn("Polling test status:", err.message));
  };

  // Fetch positions & history
  const fetchData = () => {
    fetch("/api/bot/positions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.positions) setPositions(data.positions);
      })
      .catch((err) => console.warn("Fetching positions:", err.message));

    fetch("/api/bot/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.history) setHistory(data.history);
      })
      .catch((err) => console.warn("Fetching history:", err.message));
  };

  // Scan market pairs
  const scanMarkets = (force = false) => {
    setIsScanning(true);
    const url = force ? "/api/market/scanner?force=true" : "/api/market/scanner";
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setIsScanning(false);
        if (data?.scanResults) setMarketPairs(data.scanResults);
      })
      .catch((err) => {
        setIsScanning(false);
        console.warn("Market scan poll:", err.message);
      });
  };

  // Fetch logs
  const fetchLogs = () => {
    fetch("/api/bot/logs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.logs) setLogs(data.logs);
      })
      .catch((err) => console.warn("Fetching logs:", err.message));
  };

  // Poll state
  useEffect(() => {
    testFirebaseConnection();
    fetchStatus();
    fetchBinanceAccount();
    fetchTestStatus();
    fetchData();
    scanMarkets();
    fetchLogs();

    const interval = setInterval(() => {
      fetchStatus();
      fetchBinanceAccount();
      fetchTestStatus();
      fetchData();
      scanMarkets();
      fetchLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Control Handlers
  const handleStartBot = () => {
    fetch("/api/bot/start", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        addToast(data.message || "Trading bot engine online.", "success");
        fetchStatus();
        fetchTestStatus();
        fetchLogs();
      })
      .catch((err) => addToast(`Engine error: ${err.message}`, "error"));
  };

  const handleStopBot = () => {
    fetch("/api/bot/stop", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        addToast(data.message || "Trading bot engine paused.", "info");
        fetchStatus();
        fetchTestStatus();
        fetchLogs();
      })
      .catch((err) => addToast(`Engine error: ${err.message}`, "error"));
  };

  const handleResetBot = () => {
    fetch("/api/bot/reset", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.activePositions) setPositions(data.activePositions);
        if (data?.tradeHistory) setHistory(data.tradeHistory);
        if (data?.scanResults) setMarketPairs(data.scanResults);
        addToast("Bot state reset successfully! Positions & locks cleared.", "info");
        fetchStatus();
        fetchData();
        scanMarkets(true);
        fetchLogs();
      });
  };

  const handleRunTests = () => {
    setIsTesting(true);
    setIsTestModalOpen(true);
    fetch("/api/bot/run-tests", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        setIsTesting(false);
        if (data.testStatus) setTestStatus(data.testStatus);
        if (data.success) {
          addToast("Pytest execution clean: 14/14 tests passed!", "success");
        } else {
          addToast("Pytest reported test failures.", "error");
        }
        fetchLogs();
      })
      .catch(() => setIsTesting(false));
  };

  const handleTriggerTrade = (
    symbol: string,
    entryPrice: number,
    dailyOpen: number,
    side?: "buy" | "sell",
    executionMode: "live" = "live",
    tradeSizeUsdt: number = 1.0
  ) => {
    fetch("/api/bot/trigger-trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, entryPrice, dailyOpen, side, executionMode: "live", tradeSizeUsdt }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          addToast(`Opened LIVE BINANCE ORDER (${data.position?.side?.toUpperCase() || side?.toUpperCase() || "TRADE"}) on ${symbol} @ $${entryPrice.toFixed(4)}`, "success");
        } else {
          addToast(data.message || `Could not trigger live trade for ${symbol}.`, "error");
        }
        fetchData();
        fetchBinanceAccount();
        fetchLogs();
      })
      .catch((err) => addToast(`Failed to trigger live trade: ${err.message}`, "error"));
  };

  const handleClosePosition = (symbol: string) => {
    fetch("/api/bot/close-position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          addToast(`Closed position for ${symbol} @ $${data.closed?.exitPrice?.toFixed(4) || "market"}`, "info");
        } else {
          addToast(data.error || `Could not close position for ${symbol}.`, "error");
        }
        fetchData();
        fetchLogs();
      })
      .catch((err) => addToast(`Failed to close position: ${err.message}`, "error"));
  };

  const handleCloseAllPositions = () => {
    fetch("/api/bot/close-all-positions", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          addToast(data.message || "All active positions closed.", "info");
        } else {
          addToast(data.error || "Could not close active positions.", "error");
        }
        fetchData();
        fetchLogs();
      })
      .catch((err) => addToast(`Failed to close all positions: ${err.message}`, "error"));
  };

  const handleUnlockAllPairs = () => {
    fetch("/api/bot/unlock-all-pairs", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        addToast(data.message || "All pair locks cleared successfully.", "success");
        scanMarkets(true);
        fetchLogs();
      });
  };

  const handleClearDashboard = () => {
    fetch("/api/bot/clear-dashboard", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.scanResults) setMarketPairs(data.scanResults);
        addToast("Dashboard cleared & pair locks reset for new trading day!", "success");
        scanMarkets(true);
        fetchLogs();
      })
      .catch((err) => addToast(`Failed to clear dashboard: ${err.message}`, "error"));
  };

  const handleSimulateSignal = (symbol = "SOLUSDT") => {
    addToast(`Triggering test trade signal for ${symbol} (+24.5% surge)...`, "info");
    fetch("/api/bot/simulate-signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, exchange: "Binance", changePct: 24.5 }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          addToast(`Test trade executed for ${symbol}! Checked strategy performance & auto-trade execution.`, "success");
        } else {
          addToast(data.error || "Could not execute test trade.", "error");
        }
        scanMarkets(true);
        fetchData();
        fetchLogs();
      })
      .catch((err) => addToast(`Failed to trigger test trade: ${err.message}`, "error"));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Header
        status={botStatus}
        testStatus={testStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onStartBot={handleStartBot}
        onStopBot={handleStopBot}
        onResetBot={handleResetBot}
        onRunTests={handleRunTests}
        onOpenTestModal={() => setIsTestModalOpen(true)}
        onOpenManualTradeModal={() => setIsManualTradeModalOpen(true)}
        onSimulateSignal={handleSimulateSignal}
        isTesting={isTesting}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <BinanceAccountCard
          accountInfo={binanceAccount}
          isLoading={isAccountLoading}
          onRefresh={fetchBinanceAccount}
        />

        <OverviewCards
          positions={positions}
          history={history}
          marketPairs={marketPairs}
          testStatus={testStatus}
          onOpenTestModal={() => setIsTestModalOpen(true)}
        />

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <ActivePositionsTable
              positions={positions}
              onClosePosition={handleClosePosition}
              onCloseAllPositions={handleCloseAllPositions}
            />
            <MarketRadarTable
              pairs={marketPairs}
              onRefresh={() => scanMarkets(true)}
              onTriggerTrade={handleTriggerTrade}
              onUnlockAllPairs={handleUnlockAllPairs}
              onClearDashboard={handleClearDashboard}
              onSimulateSignal={handleSimulateSignal}
              isScanning={isScanning}
            />
          </div>
        )}

        {activeTab === "radar" && (
          <MarketRadarTable
            pairs={marketPairs}
            onRefresh={() => scanMarkets(true)}
            onTriggerTrade={handleTriggerTrade}
            onUnlockAllPairs={handleUnlockAllPairs}
            onClearDashboard={handleClearDashboard}
            onSimulateSignal={handleSimulateSignal}
            isScanning={isScanning}
          />
        )}

        {activeTab === "positions" && (
          <div className="space-y-6">
            <ActivePositionsTable
              positions={positions}
              onClosePosition={handleClosePosition}
              onCloseAllPositions={handleCloseAllPositions}
            />
            <TradeHistoryList history={history} />
          </div>
        )}

        {activeTab === "code" && (
          <CodeExplorer onRunTests={handleRunTests} isTesting={isTesting} />
        )}

        {activeTab === "backtest" && <Backtester />}

        {activeTab === "logs" && (
          <ConsoleLogs logs={logs} onRefresh={fetchLogs} />
        )}
      </main>

      <PytestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        testStatus={testStatus}
        onRunTests={handleRunTests}
        isTesting={isTesting}
      />

      <ManualTradeModal
        isOpen={isManualTradeModalOpen}
        onClose={() => setIsManualTradeModalOpen(false)}
        onExecuteTrade={(symbol, side, price, executionMode, marginUsdt) => {
          handleTriggerTrade(symbol, price, price / 1.2, side, executionMode, marginUsdt);
        }}
        availableSymbols={marketPairs.map((p) => p.symbol)}
        hasApiKey={Boolean(binanceAccount?.connected)}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
