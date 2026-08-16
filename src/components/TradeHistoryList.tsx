import React, { useState, useMemo } from "react";
import { History, TrendingUp, Percent, DollarSign, Calendar, Filter, RotateCcw } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { TradeHistoryItem } from "../types";

interface TradeHistoryListProps {
  history: TradeHistoryItem[];
}

type DatePreset = "all" | "24h" | "7d" | "30d" | "custom";

export const TradeHistoryList: React.FC<TradeHistoryListProps> = ({ history }) => {
  const [metricMode, setMetricMode] = useState<"percentage" | "usdt">("percentage");
  const [preset, setPreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Filter history based on date preset or custom range
  const filteredHistory = useMemo(() => {
    if (history.length === 0) return [];

    const now = new Date();

    if (preset === "24h") {
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return history.filter((item) => new Date(item.closedAt) >= cutoff);
    }

    if (preset === "7d") {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return history.filter((item) => new Date(item.closedAt) >= cutoff);
    }

    if (preset === "30d") {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return history.filter((item) => new Date(item.closedAt) >= cutoff);
    }

    if (preset === "custom") {
      let result = [...history];
      if (startDate) {
        const start = new Date(startDate);
        result = result.filter((item) => new Date(item.closedAt) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        // Include full day of endDate
        end.setHours(23, 59, 59, 999);
        result = result.filter((item) => new Date(item.closedAt) <= end);
      }
      return result;
    }

    return history;
  }, [history, preset, startDate, endDate]);

  // Sort chronologically (oldest to newest) for chart timeline
  let runningCumulativePct = 0;
  let runningCumulativeUsdt = 0;

  const chronologicalHistory = [...filteredHistory].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );

  const chartData = chronologicalHistory.map((item, idx) => {
    runningCumulativePct += item.pnlPct;
    runningCumulativeUsdt += item.pnlUsdt;
    const closedDate = new Date(item.closedAt);
    const timeLabel = `${closedDate.getHours().toString().padStart(2, "0")}:${closedDate
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    return {
      index: idx + 1,
      tradeLabel: `#${idx + 1} ${item.symbol}`,
      time: timeLabel,
      dateStr: closedDate.toLocaleDateString(),
      symbol: item.symbol,
      pnlPct: Number(item.pnlPct.toFixed(2)),
      cumulativePct: Number(runningCumulativePct.toFixed(2)),
      pnlUsdt: Number(item.pnlUsdt.toFixed(2)),
      cumulativeUsdt: Number(runningCumulativeUsdt.toFixed(2)),
    };
  });

  const avgPnLPct =
    filteredHistory.length > 0
      ? filteredHistory.reduce((sum, item) => sum + item.pnlPct, 0) / filteredHistory.length
      : 0;

  const winRate =
    filteredHistory.length > 0
      ? (filteredHistory.filter((item) => item.pnlPct > 0).length / filteredHistory.length) * 100
      : 0;

  const handleResetFilters = () => {
    setPreset("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      {/* Filter Control Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
                <span>Date Range Filter</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-normal">
                  Showing {filteredHistory.length} of {history.length} trades
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Filter closed trade history logs and PnL performance metrics.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Presets */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(["all", "24h", "7d", "30d", "custom"] as DatePreset[]).map((p) => {
                const labels: Record<DatePreset, string> = {
                  all: "All Time",
                  "24h": "24 Hours",
                  "7d": "7 Days",
                  "30d": "30 Days",
                  custom: "Custom",
                };
                return (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                      preset === p
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>

            {/* Custom Inputs */}
            {preset === "custom" && (
              <div className="flex items-center space-x-2 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            )}

            {/* Reset Button */}
            {(preset !== "all" || startDate || endDate) && (
              <button
                onClick={handleResetFilters}
                className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recharts Performance Line Chart */}
      {chartData.length > 0 ? (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Closed Trades PnL Performance Line Chart</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time tracking of trade percentage returns and cumulative performance trajectory over time.
              </p>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setMetricMode("percentage")}
                  className={`px-3 py-1 rounded-md font-medium transition flex items-center space-x-1 ${
                    metricMode === "percentage"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Percent className="w-3 h-3" />
                  <span>PnL %</span>
                </button>
                <button
                  onClick={() => setMetricMode("usdt")}
                  className={`px-3 py-1 rounded-md font-medium transition flex items-center space-x-1 ${
                    metricMode === "usdt"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <span>PnL USDT</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-sans">Filtered Trades</span>
              <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                {filteredHistory.length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-sans">Win Rate</span>
              <div className="text-sm font-bold font-mono text-sky-400 mt-0.5">
                {winRate.toFixed(1)}%
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-sans">Avg Trade PnL %</span>
              <div
                className={`text-sm font-bold font-mono mt-0.5 ${
                  avgPnLPct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {avgPnLPct >= 0 ? "+" : ""}
                {avgPnLPct.toFixed(2)}%
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-sans">Cumulative PnL</span>
              <div
                className={`text-sm font-bold font-mono mt-0.5 ${
                  runningCumulativePct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {metricMode === "percentage"
                  ? `${runningCumulativePct >= 0 ? "+" : ""}${runningCumulativePct.toFixed(2)}%`
                  : `${runningCumulativeUsdt >= 0 ? "+" : ""}$${runningCumulativeUsdt.toFixed(2)} USDT`}
              </div>
            </div>
          </div>

          {/* Line Chart */}
          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="tradeLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  unit={metricMode === "percentage" ? "%" : " $"}
                />
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg shadow-xl font-mono text-xs space-y-1">
                          <div className="text-slate-200 font-bold font-sans border-b border-slate-800 pb-1 mb-1">
                            Trade #{data.index} • {data.symbol} ({data.dateStr} {data.time})
                          </div>
                          <div className="flex justify-between space-x-4">
                            <span className="text-slate-400">Trade PnL %:</span>
                            <span
                              className={
                                data.pnlPct >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"
                              }
                            >
                              {data.pnlPct >= 0 ? "+" : ""}
                              {data.pnlPct}%
                            </span>
                          </div>
                          <div className="flex justify-between space-x-4">
                            <span className="text-slate-400">Cumulative PnL %:</span>
                            <span
                              className={
                                data.cumulativePct >= 0
                                  ? "text-emerald-400 font-bold"
                                  : "text-rose-400 font-bold"
                              }
                            >
                              {data.cumulativePct >= 0 ? "+" : ""}
                              {data.cumulativePct}%
                            </span>
                          </div>
                          <div className="flex justify-between space-x-4 pt-1 border-t border-slate-800/60">
                            <span className="text-slate-400">Trade PnL USDT:</span>
                            <span className="text-emerald-400 font-bold">
                              +${data.pnlUsdt.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  formatter={(value) => <span className="text-slate-300 font-sans">{value}</span>}
                />
                {metricMode === "percentage" ? (
                  <>
                    <Line
                      type="monotone"
                      name="Cumulative PnL %"
                      dataKey="cumulativePct"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ fill: "#10b981", r: 4 }}
                      activeDot={{ r: 6, stroke: "#34d399", strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      name="Trade PnL %"
                      dataKey="pnlPct"
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={{ fill: "#38bdf8", r: 3 }}
                    />
                  </>
                ) : (
                  <>
                    <Line
                      type="monotone"
                      name="Cumulative PnL (USDT)"
                      dataKey="cumulativeUsdt"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ fill: "#10b981", r: 4 }}
                      activeDot={{ r: 6, stroke: "#34d399", strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      name="Trade PnL (USDT)"
                      dataKey="pnlUsdt"
                      stroke="#a855f7"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={{ fill: "#a855f7", r: 3 }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
          No trade records match the selected date filter window.
        </div>
      )}

      {/* Trade History Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <History className="w-4 h-4 text-sky-400" />
              <span>Closed Trade History Logs</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Completed positions with entry/exit pricing, PnL %, and trade duration.
            </p>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No trade history recorded for the current filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/50 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Exchange</th>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Side</th>
                  <th className="py-3 px-4">Opened At</th>
                  <th className="py-3 px-4">Entry Price</th>
                  <th className="py-3 px-4">Exit Price</th>
                  <th className="py-3 px-4">Daily Open (00:00 UTC)</th>
                  <th className="py-3 px-4">PnL (%)</th>
                  <th className="py-3 px-4">PnL (USDT)</th>
                  <th className="py-3 px-4 text-right">Closed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {filteredHistory.map((item, idx) => {
                  const isBuy = item.side === "buy" || item.side === "LONG" || !item.side;
                  return (
                    <tr key={`${item.id}-${item.symbol}-${idx}`} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-sans">
                        <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                          <span>LIVE BINANCE</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">{item.symbol}</td>
                      <td className="py-3 px-4">
                        {isBuy ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            LONG / BUY
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            SHORT / SELL
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {item.openedAt ? new Date(item.openedAt).toLocaleString() : "-"}
                      </td>
                      <td className="py-3 px-4">${item.entryPrice.toFixed(4)}</td>
                      <td className="py-3 px-4 font-bold text-slate-100">
                        ${item.exitPrice.toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">${item.dailyOpen.toFixed(4)}</td>
                      <td className={`py-3 px-4 font-bold ${item.pnlPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {item.pnlPct >= 0 ? "+" : ""}{item.pnlPct.toFixed(2)}%
                      </td>
                      <td className={`py-3 px-4 font-bold ${item.pnlUsdt >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {item.pnlUsdt >= 0 ? "+" : ""}${item.pnlUsdt.toFixed(2)} USDT
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {new Date(item.closedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

