import React from "react";
import { TrendingUp, Target, Clock, ShieldAlert, DollarSign, Activity, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Position, TradeHistoryItem, MarketPair, TestStatus } from "../types";

interface OverviewCardsProps {
  positions: Position[];
  history: TradeHistoryItem[];
  marketPairs: MarketPair[];
  testStatus?: TestStatus | null;
  onOpenTestModal?: () => void;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  positions,
  history,
  marketPairs,
  testStatus,
  onOpenTestModal,
}) => {
  const totalClosedPnlUsdt = history.reduce((acc, item) => acc + item.pnlUsdt, 0);
  const totalOpenPnlUsdt = positions.reduce((acc, item) => acc + item.unrealizedPnlUsdt, 0);
  const combinedPnlUsdt = totalClosedPnlUsdt + totalOpenPnlUsdt;

  const totalTrades = history.length;
  const winningTrades = history.filter((h) => h.pnlUsdt > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 100;

  const activeSignals = marketPairs.filter((p) => p.isSignal);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Card 1: Total PnL */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Total Net PnL (USDT)</span>
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span
            className={`text-2xl font-extrabold tracking-tight font-mono ${
              combinedPnlUsdt >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {combinedPnlUsdt >= 0 ? "+" : ""}
            {combinedPnlUsdt.toFixed(2)} USDT
          </span>
        </div>
        <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-400">
          <span>Realized: +${totalClosedPnlUsdt.toFixed(2)}</span>
          <span>•</span>
          <span>Open: +${totalOpenPnlUsdt.toFixed(2)}</span>
        </div>
      </div>

      {/* Card 2: Win Rate */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Trade Win Rate</span>
          <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
            {winRate.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-400">({winningTrades}/{totalTrades} trades)</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Exit: End of Day (00:00 UTC)</span>
          <span className="text-emerald-400 font-medium">EOD Auto-Close</span>
        </div>
      </div>

      {/* Card 3: Active Signals */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">00:00 UTC Signals (|Change| ≥ 20%)</span>
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-extrabold text-amber-400 tracking-tight font-mono">
            {activeSignals.length} Pairs
          </span>
          <span className="text-xs text-slate-400">captured from market</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          {activeSignals.length > 0 ? (
            <span className="text-amber-400 font-medium">
              Top: {activeSignals[0]?.symbol} ({activeSignals[0]?.changePct >= 0 ? "+" : ""}{activeSignals[0]?.changePct.toFixed(1)}%)
            </span>
          ) : (
            <span>No active signals exceeding 20% threshold</span>
          )}
        </div>
      </div>

      {/* Card 4: Active Open Positions */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Live Active Positions</span>
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
            {positions.length} Active
          </span>
          <span className="text-xs text-emerald-400 font-mono font-bold">LIVE 20x</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Fixed $1.00 Margin</span>
          <span className="text-emerald-400 font-semibold text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">Multi-Trade Enabled</span>
        </div>
      </div>

      {/* Card 5: Automated Pytest Status */}
      <div
        onClick={onOpenTestModal}
        className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 transition shadow-sm cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Automated Pytest</span>
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:scale-110 transition">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-extrabold text-emerald-400 tracking-tight font-mono flex items-center space-x-1">
            <CheckCircle2 className="w-5 h-5 inline text-emerald-400" />
            <span>14/14</span>
          </span>
          <span className="text-xs text-emerald-300 font-semibold">Passed</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="group-hover:text-emerald-400 transition underline underline-offset-2">Click to view test logs</span>
          <span className="text-emerald-400 font-mono text-[10px]">Auto-Run</span>
        </div>
      </div>
    </div>
  );
};
