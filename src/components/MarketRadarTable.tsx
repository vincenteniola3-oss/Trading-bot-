import React, { useState } from "react";
import { Zap, RefreshCw, Lock, Globe, Unlock, Sparkles, Filter, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { MarketPair } from "../types";

interface MarketRadarTableProps {
  pairs: MarketPair[];
  onRefresh: () => void;
  onTriggerTrade: (symbol: string, price: number, dailyOpen: number, side?: "buy" | "sell") => void;
  onUnlockAllPairs?: () => void;
  onClearDashboard?: () => void;
  onSimulateSignal?: (symbol?: string) => void;
  isScanning: boolean;
}

const EXCHANGES = ["ALL", "Binance", "Bybit", "OKX", "Gate.io", "KuCoin", "Bitget", "MEXC"];

const getExchangeBadgeStyle = (exchange?: string) => {
  switch (exchange) {
    case "Binance":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "Bybit":
      return "bg-sky-500/10 text-sky-400 border-sky-500/30";
    case "OKX":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "Gate.io":
      return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    case "KuCoin":
      return "bg-teal-500/10 text-teal-400 border-teal-500/30";
    case "Bitget":
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
    case "MEXC":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
    default:
      return "bg-slate-800 text-slate-300 border-slate-700";
  }
};

const formatNextFundingTime = (nextTime?: number) => {
  if (!nextTime) return "in 8h";
  const diffMs = Math.max(0, nextTime - Date.now());
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

export const MarketRadarTable: React.FC<MarketRadarTableProps> = ({
  pairs,
  onRefresh,
  onTriggerTrade,
  onUnlockAllPairs,
  onClearDashboard,
  onSimulateSignal,
  isScanning,
}) => {
  const [selectedExchange, setSelectedExchange] = useState<string>("ALL");
  const [perfFilter, setPerfFilter] = useState<string>("20"); // "20", "15", "10", "5", "gainers", "losers", "all"
  const [dirFilter, setDirFilter] = useState<string>("all"); // "all", "longs", "shorts"

  const movers20Count = pairs.filter((p) => Math.abs(p.changePct) >= 20.0).length;
  const movers15Count = pairs.filter((p) => Math.abs(p.changePct) >= 15.0).length;
  const movers10Count = pairs.filter((p) => Math.abs(p.changePct) >= 10.0).length;
  const movers5Count = pairs.filter((p) => Math.abs(p.changePct) >= 5.0).length;
  const gainersCount = pairs.filter((p) => p.changePct > 0).length;
  const losersCount = pairs.filter((p) => p.changePct < 0).length;

  const filteredPairs = pairs.filter((p) => {
    if (selectedExchange !== "ALL" && (p.exchange || "Binance").toLowerCase() !== selectedExchange.toLowerCase()) {
      return false;
    }
    if (dirFilter === "longs" && p.changePct < 0) return false;
    if (dirFilter === "shorts" && p.changePct >= 0) return false;

    const absPct = Math.abs(p.changePct);
    if (perfFilter === "20") return absPct >= 20.0;
    if (perfFilter === "15") return absPct >= 15.0;
    if (perfFilter === "10") return absPct >= 10.0;
    if (perfFilter === "5") return absPct >= 5.0;
    if (perfFilter === "gainers") return p.changePct > 0;
    if (perfFilter === "losers") return p.changePct < 0;
    return true;
  });

  const lockedCount = pairs.filter((p) => p.isLocked).length;

  // Funding Rate Sentiment Calculation
  const validFundingPairs = pairs.filter((p) => p.fundingRatePct !== undefined);
  const avgFundingPct = validFundingPairs.length > 0
    ? validFundingPairs.reduce((acc, p) => acc + (p.fundingRatePct || 0), 0) / validFundingPairs.length
    : 0.015;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
      {/* Auto-Scan & Funding Status Banner */}
      <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 text-emerald-300 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Binance 24/7 Scanner & Daily Performance Monitor</span>
          <span className="text-slate-400 font-normal hidden sm:inline">
            • Benchmark: 00:00 UTC Open Price
          </span>
        </div>
        <div className="text-[11px] text-emerald-400 font-mono flex items-center space-x-3">
          <span className="flex items-center space-x-1 bg-slate-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            <span>Avg Funding (8h):</span>
            <strong className={avgFundingPct >= 0 ? "text-emerald-300" : "text-purple-300"}>
              {avgFundingPct >= 0 ? "+" : ""}{avgFundingPct.toFixed(4)}%
            </strong>
          </span>
          <div className="flex items-center space-x-1">
            <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
            <span>Auto-Trade Rule: Fresh 20% Cross → 20x ($1) Position</span>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Binance Market Radar</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
              00:00 UTC Benchmark
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitors Binance USDT Perpetual Futures markets relative to 00:00 UTC daily open price. Triggers auto-trade on fresh ±20% moves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSimulateSignal && (
            <button
              onClick={() => onSimulateSignal()}
              className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition font-bold shadow-md shadow-emerald-500/20"
              title="Simulate a fresh +24.5% surge crossing event to test bot auto-execution"
            >
              <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
              <span>Test Signal (+24.5%)</span>
            </button>
          )}

          {onClearDashboard && (
            <button
              onClick={onClearDashboard}
              className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition font-medium"
              title="Clear previous dashboard state, locks, and start fresh 00:00 UTC monitoring for today"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Dashboard (New Day)</span>
            </button>
          )}

          {onUnlockAllPairs && (
            <button
              onClick={onUnlockAllPairs}
              className="flex items-center space-x-1 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition font-medium"
              title="Clear pair re-entry locks so signals can auto-trade again"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              <span>Unlock All Pairs {lockedCount > 0 ? `(${lockedCount})` : ""}</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isScanning}
            className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-emerald-400" : ""}`} />
            <span>Scan Binance Market</span>
          </button>
        </div>
      </div>

      {/* Daily Performance Filter Bar */}
      <div className="bg-slate-950/60 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-medium mr-1 flex items-center space-x-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Daily Performance Filter:</span>
          </span>

          <button
            onClick={() => setPerfFilter("20")}
            className={`px-2.5 py-1 rounded-md transition text-xs font-semibold shrink-0 flex items-center space-x-1 border ${
              perfFilter === "20"
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <Zap className={`w-3 h-3 ${perfFilter === "20" ? "fill-slate-950" : "text-emerald-400"}`} />
            <span>20%+ Signals ({movers20Count})</span>
          </button>

          <button
            onClick={() => setPerfFilter("15")}
            className={`px-2.5 py-1 rounded-md transition text-xs font-medium shrink-0 border ${
              perfFilter === "15"
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <span>15%+ ({movers15Count})</span>
          </button>

          <button
            onClick={() => setPerfFilter("10")}
            className={`px-2.5 py-1 rounded-md transition text-xs font-medium shrink-0 border ${
              perfFilter === "10"
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <span>10%+ ({movers10Count})</span>
          </button>

          <button
            onClick={() => setPerfFilter("5")}
            className={`px-2.5 py-1 rounded-md transition text-xs font-medium shrink-0 border ${
              perfFilter === "5"
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <span>5%+ ({movers5Count})</span>
          </button>

          <button
            onClick={() => setPerfFilter("gainers")}
            className={`px-2.5 py-1 rounded-md transition text-xs font-medium shrink-0 border ${
              perfFilter === "gainers"
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow"
                : "bg-slate-800/80 hover:bg-slate-800 text-emerald-400 border-slate-700"
            }`}
          >
            <span>Gainers ({gainersCount})</span>
          </button>

          <button
            onClick={() => setPerfFilter("losers")}
            className={`px-2.5 py-1 rounded-md transition text-xs font-medium shrink-0 border ${
              perfFilter === "losers"
                ? "bg-rose-500 text-slate-950 border-rose-400 shadow"
                : "bg-slate-800/80 hover:bg-slate-800 text-rose-400 border-slate-700"
            }`}
          >
            <span>Losers ({losersCount})</span>
          </button>

          <button
            onClick={() => setPerfFilter("all")}
            className={`px-2.5 py-1 rounded-md transition text-xs font-medium shrink-0 border ${
              perfFilter === "all"
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <span>All Monitored ({pairs.length})</span>
          </button>
        </div>

        {/* Direction Filter */}
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-slate-400 font-medium mr-1 text-[11px]">Direction:</span>
          <button
            onClick={() => setDirFilter("all")}
            className={`px-2 py-0.5 rounded transition text-[11px] font-medium ${
              dirFilter === "all" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setDirFilter("longs")}
            className={`px-2 py-0.5 rounded transition text-[11px] font-medium flex items-center space-x-0.5 ${
              dirFilter === "longs" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-emerald-300"
            }`}
          >
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            <span>Longs</span>
          </button>
          <button
            onClick={() => setDirFilter("shorts")}
            className={`px-2 py-0.5 rounded transition text-[11px] font-medium flex items-center space-x-0.5 ${
              dirFilter === "shorts" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "text-slate-400 hover:text-rose-300"
            }`}
          >
            <ArrowDownRight className="w-3 h-3 text-rose-400" />
            <span>Shorts</span>
          </button>
        </div>
      </div>

      {/* Exchange Filter Selector */}
      <div className="bg-slate-950/40 px-4 py-2 border-b border-slate-800 flex items-center justify-between overflow-x-auto text-xs gap-2">
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-slate-400 font-medium mr-2 flex items-center space-x-1 shrink-0">
            <span>Filter Exchange:</span>
          </span>
          {EXCHANGES.map((ex) => (
            <button
              key={ex}
              onClick={() => setSelectedExchange(ex)}
              className={`px-2.5 py-1 rounded-md transition text-xs font-medium shrink-0 ${
                selectedExchange === ex
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/50"
              }`}
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-400 shrink-0 font-mono">
          Showing {filteredPairs.length} of {pairs.length} pairs
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/50 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Exchange</th>
              <th className="py-3 px-4">Symbol / Pair</th>
              <th className="py-3 px-4">Mark Price</th>
              <th className="py-3 px-4">Daily Open (00:00 UTC)</th>
              <th className="py-3 px-4">Change vs Daily Open</th>
              <th className="py-3 px-4">Funding Rate (8h)</th>
              <th className="py-3 px-4">Threshold Meter (20%)</th>
              <th className="py-3 px-4">24h Quote Vol</th>
              <th className="py-3 px-4 text-right">Action / Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
            {filteredPairs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 px-4 text-center text-slate-400 font-sans">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Zap className="w-8 h-8 text-slate-600" />
                    <p className="font-semibold text-slate-300">No Pairs Matching Selected Daily Performance Filter</p>
                    <p className="text-xs text-slate-500 max-w-md">
                      {perfFilter === "20"
                        ? "The 24/7 Binance scanner is actively monitoring all market pairs. No pairs have crossed the ±20% threshold right now. Switch to 'All Monitored' or '10%+' to view lower volatility movers."
                        : "No pairs match the selected performance or exchange filter."}
                    </p>
                    {perfFilter === "20" && (
                      <button
                        onClick={() => setPerfFilter("all")}
                        className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-mono transition"
                      >
                        Show All Monitored Pairs ({pairs.length})
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredPairs.map((pair, idx) => {
                const isSignal = Math.abs(pair.changePct) >= 20.0;
                const progressPct = Math.min(100, Math.max(0, (Math.abs(pair.changePct) / 20.0) * 100));
                const exchangeName = pair.exchange || "Binance";

                return (
                  <tr
                    key={`${pair.symbol}-${exchangeName}-${idx}`}
                    className={`hover:bg-slate-800/40 transition ${
                      isSignal ? "bg-emerald-500/5" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-sans">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getExchangeBadgeStyle(exchangeName)}`}>
                        {exchangeName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100 flex items-center space-x-2">
                      <span>{pair.symbol}</span>
                      {isSignal && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center space-x-1 border ${
                          pair.justCrossed
                            ? pair.changePct >= 0
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm animate-pulse font-bold"
                              : "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm animate-pulse font-bold"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                        title={pair.justCrossed ? "FRESH 20% CROSSING: Triggered within last 5 minutes. Eligible for auto-trade." : "ESTABLISHED MOVER: Has been above 20% for a long time. Auto-trade skipped."}
                        >
                          <Zap className={`w-3 h-3 ${
                            pair.justCrossed
                              ? pair.changePct >= 0 ? "text-emerald-400 fill-emerald-400" : "text-rose-400 fill-rose-400"
                              : "text-slate-400"
                          }`} />
                          <span>
                            {pair.justCrossed
                              ? pair.changePct >= 0 ? "FRESH 20% CROSS (AUTO-TRADE)" : "FRESH -20% CROSS (AUTO-TRADE)"
                              : pair.changePct >= 0 ? "+20% (ESTABLISHED)" : "-20% (ESTABLISHED)"}
                          </span>
                        </span>
                      )}
                      {pair.isLocked && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center space-x-1 cursor-pointer hover:bg-amber-500/20"
                          title="Pair locked after position exit to prevent overtrading. Click Unlock All Pairs above to clear."
                        >
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          <span>LOCKED</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-100">
                      ${pair.price < 1 ? pair.price.toFixed(4) : pair.price.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      ${pair.dailyOpen < 1 ? pair.dailyOpen.toFixed(4) : pair.dailyOpen.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      <span
                        className={pair.changePct >= 0 ? "text-emerald-400" : "text-rose-400"}
                      >
                        {pair.changePct >= 0 ? "+" : ""}
                        {pair.changePct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {pair.fundingRatePct !== undefined ? (
                        <div className="flex flex-col space-y-0.5">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded border inline-flex items-center space-x-1 ${
                              Math.abs(pair.fundingRatePct) >= 0.05
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : pair.fundingRatePct >= 0
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                            }`}
                            title={
                              pair.fundingRatePct >= 0
                                ? "Positive Funding Rate: Long traders pay Short traders every 8h"
                                : "Negative Funding Rate: Short traders pay Long traders every 8h"
                            }
                          >
                            <span>
                              {pair.fundingRatePct >= 0 ? "+" : ""}
                              {pair.fundingRatePct.toFixed(4)}%
                            </span>
                            <span className="text-[9px] opacity-80 font-normal">
                              ({pair.fundingRatePct >= 0 ? "Longs Pay" : "Shorts Pay"})
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Next: {formatNextFundingTime(pair.nextFundingTime)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 min-w-[140px]">
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isSignal
                              ? pair.changePct >= 0
                                ? "bg-emerald-400"
                                : "bg-rose-400"
                              : "bg-sky-500/80"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      ${(pair.volume / 1000000).toFixed(1)}M
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => onTriggerTrade(pair.symbol, pair.price, pair.dailyOpen, "buy")}
                          className="text-[11px] px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold transition flex items-center space-x-1"
                          title={`Open 20x LONG trade on ${pair.symbol}`}
                        >
                          <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                          <span>LONG</span>
                        </button>
                        <button
                          onClick={() => onTriggerTrade(pair.symbol, pair.price, pair.dailyOpen, "sell")}
                          className="text-[11px] px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold transition flex items-center space-x-1"
                          title={`Open 20x SHORT trade on ${pair.symbol}`}
                        >
                          <Zap className="w-3 h-3 text-rose-400 fill-rose-400" />
                          <span>SHORT</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
