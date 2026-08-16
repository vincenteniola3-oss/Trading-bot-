import React from "react";
import { CheckCircle2, Clock, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Position } from "../types";

interface ActivePositionsTableProps {
  positions: Position[];
  onClosePosition: (symbol: string) => void;
  onCloseAllPositions?: () => void;
}

const PriceSparkline: React.FC<{ entryPrice: number; currentPrice: number; isBuy: boolean; pnlPct: number }> = ({
  entryPrice,
  currentPrice,
  isBuy,
  pnlPct,
}) => {
  const isProfitable = pnlPct >= 0;
  const strokeColor = isProfitable ? "#34d399" : "#f87171"; // emerald-400 or rose-400
  const fillColor = isProfitable ? "rgba(52, 211, 153, 0.15)" : "rgba(248, 113, 113, 0.15)";
  
  // Calculate relative positions in a 100x30 SVG canvas
  // Base line at y = 15
  const diffPct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const clampedDiff = Math.max(-15, Math.min(15, diffPct));
  // If buy: positive diff goes UP (y decreases), if sell: positive diff is when current < entry
  const yOffset = isBuy ? -clampedDiff * 0.8 : clampedDiff * 0.8;
  const endY = Math.max(4, Math.min(26, 15 + yOffset));

  // Generate smooth cubic bezier points for realistic sparkline curve
  const midY1 = 15 + yOffset * 0.3 + (isProfitable ? -2 : 2);
  const midY2 = 15 + yOffset * 0.7 + (isProfitable ? -1 : 1);
  const pathD = `M 4,15 C 30,${midY1} 60,${midY2} 96,${endY}`;
  const fillPathD = `M 4,15 C 30,${midY1} 60,${midY2} 96,${endY} L 96,28 L 4,28 Z`;

  return (
    <div className="flex items-center space-x-2">
      <svg width="100" height="30" className="overflow-visible">
        <defs>
          <linearGradient id={`grad-${entryPrice}-${currentPrice}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Baseline Entry Price Line */}
        <line x1="4" y1="15" x2="96" y2="15" stroke="#475569" strokeDasharray="2 2" strokeWidth="1" opacity="0.6" />
        
        {/* Shaded Area */}
        <path d={fillPathD} fill={fillColor} />

        {/* Dynamic Sparkline Path */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

        {/* Start Dot (Entry) */}
        <circle cx="4" cy="15" r="2.5" fill="#94a3b8" />

        {/* End Dot (Current) */}
        <circle cx="96" cy={endY} r="3" fill={strokeColor} className="animate-pulse" />
      </svg>
      <div className="text-[10px] flex flex-col font-mono leading-tight">
        <span className="text-slate-500 text-[9px]">Entry Base</span>
        <span className={isProfitable ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

export const ActivePositionsTable: React.FC<ActivePositionsTableProps> = ({
  positions,
  onClosePosition,
  onCloseAllPositions,
}) => {
  if (positions.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
        <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-200">No Open Positions</h3>
        <p className="text-xs text-slate-400 mt-1">
          When the scanner identifies a pair rising ≥ +20% from 00:00 UTC daily open, position will automatically open here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <span>Live Active Positions</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
              {positions.length} Active Position{positions.length > 1 ? "s" : ""}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitored continuously on Live Binance Futures. Positions are held until End of Day (00:00 UTC) or via Manual Exit.
          </p>
        </div>
        {onCloseAllPositions && (
          <button
            onClick={onCloseAllPositions}
            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center space-x-1"
            title="Close all open active positions instantly"
          >
            <span>Close All Positions</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/50 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Exchange</th>
              <th className="py-3 px-4">Symbol</th>
              <th className="py-3 px-4">Side</th>
              <th className="py-3 px-4">Opened Timestamp</th>
              <th className="py-3 px-4">Entry Price</th>
              <th className="py-3 px-4">Current Price</th>
              <th className="py-3 px-4">Price Trajectory</th>
              <th className="py-3 px-4">Exit Strategy</th>
              <th className="py-3 px-4">Funding (8h)</th>
              <th className="py-3 px-4">Quantity</th>
              <th className="py-3 px-4">Unrealized PnL</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
            {positions.map((pos, idx) => {
              const isBuy = pos.side === "buy" || pos.side === "LONG" || !pos.side;
              const pnlPct = isBuy
                ? ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100
                : ((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100;
              const pnlUsdt = (pnlPct / 100) * pos.entryPrice * pos.quantity;

              const formatOpenedAt = (dateStr?: string) => {
                if (!dateStr) return { timeStr: "Just now", durationStr: "" };
                try {
                  const d = new Date(dateStr);
                  if (isNaN(d.getTime())) return { timeStr: dateStr, durationStr: "" };
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const diffMs = Math.max(0, Date.now() - d.getTime());
                  const mins = Math.floor(diffMs / 60000);
                  const hrs = Math.floor(mins / 60);
                  const remMins = mins % 60;
                  const durationStr = hrs > 0 ? `${hrs}h ${remMins}m open` : (mins > 0 ? `${mins}m open` : "Just opened");
                  return { timeStr: `${dateFormatted} ${timeStr}`, durationStr };
                } catch {
                  return { timeStr: dateStr, durationStr: "" };
                }
              };

              const openedInfo = formatOpenedAt(pos.openedAt);

              return (
                <tr key={`${pos.id}-${pos.symbol}-${idx}`} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-sans">
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>LIVE BINANCE</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-100">{pos.symbol}</td>
                  <td className="py-3 px-4">
                    {isBuy ? (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        LONG / BUY (20x)
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        SHORT / SELL (20x)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <div className="flex flex-col text-[11px]">
                      <span className="font-semibold text-slate-200 flex items-center space-x-1 font-mono">
                        <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{openedInfo.timeStr}</span>
                      </span>
                      {openedInfo.durationStr && (
                        <span className="text-[10px] text-emerald-400/80 font-mono font-medium">
                          {openedInfo.durationStr}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">${pos.entryPrice.toFixed(4)}</td>
                  <td className="py-3 px-4 font-bold text-slate-100">${pos.currentPrice.toFixed(4)}</td>
                  <td className="py-3 px-4">
                    <PriceSparkline
                      entryPrice={pos.entryPrice}
                      currentPrice={pos.currentPrice}
                      isBuy={isBuy}
                      pnlPct={pnlPct}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-300 inline-flex items-center space-x-1">
                      <ArrowUpRight className="w-3 h-3 text-emerald-400 inline" />
                      <span>End of Day (00:00 UTC) / Manual Exit</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {pos.fundingRatePct !== undefined ? (
                      <div className="flex flex-col text-[11px]">
                        <span className={`font-bold ${pos.fundingRatePct >= 0 ? "text-emerald-400" : "text-purple-400"}`}>
                          {pos.fundingRatePct >= 0 ? "+" : ""}{pos.fundingRatePct.toFixed(4)}%
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Est. Fee: {pos.estimatedFundingFeeUsdt !== undefined ? (pos.estimatedFundingFeeUsdt >= 0 ? `+$${pos.estimatedFundingFeeUsdt.toFixed(4)}` : `-$${Math.abs(pos.estimatedFundingFeeUsdt).toFixed(4)}`) : "N/A"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{pos.quantity.toFixed(4)}</td>
                  <td className="py-3 px-4 font-bold">
                    <span className={pnlPct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}% ({pnlUsdt >= 0 ? "+" : ""}${pnlUsdt.toFixed(2)} USDT)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onClosePosition(pos.symbol)}
                      className="text-xs px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-sans font-medium transition"
                    >
                      Close Position
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
