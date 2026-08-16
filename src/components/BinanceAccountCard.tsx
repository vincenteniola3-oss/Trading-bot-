import React, { useState } from "react";
import { Wallet, ShieldCheck, RefreshCw, Key, ArrowUpRight, AlertCircle, CheckCircle2, Lock, ExternalLink, Copy, Check } from "lucide-react";
import { BinanceAccountInfo } from "../types";

interface BinanceAccountCardProps {
  accountInfo: BinanceAccountInfo | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenSettings?: () => void;
}

export const BinanceAccountCard: React.FC<BinanceAccountCardProps> = ({
  accountInfo,
  isLoading,
  onRefresh,
  onOpenSettings,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);

  // Extract IP if present in error message (e.g., request ip: 34.34.246.237)
  const ipMatch = accountInfo?.error?.match(/request ip:\s*([0-9.]+)/i);
  const serverIp = ipMatch ? ipMatch[1] : "34.34.246.237";

  const handleCopyIp = () => {
    navigator.clipboard.writeText(serverIp);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const is401Error = accountInfo?.error?.includes("401") || accountInfo?.error?.includes("Invalid API-key");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-sm relative overflow-hidden">
      {/* Background Accent glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Account Header Info */}
        <div className="flex items-start space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-1.5">
                <span>Binance Futures Account</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  USDT-M Live
                </span>
              </h3>
              {accountInfo?.connected ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>CONNECTED</span>
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span>CHECK CONNECTION</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400 font-mono">
              {accountInfo?.apiKeyMasked && (
                <span className="flex items-center space-x-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>API Key: {accountInfo.apiKeyMasked}</span>
                </span>
              )}
              {accountInfo?.canTrade !== undefined && (
                <span className="text-emerald-400 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Trade Permissions: Active</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Balance Metrics */}
        <div className="flex items-center space-x-6 bg-slate-950/60 px-4 py-2.5 rounded-lg border border-slate-800/80">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Available USDT</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">
              ${accountInfo?.availableBalance !== undefined ? accountInfo.availableBalance.toFixed(2) : "0.00"}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Total Wallet Balance</span>
            <span className="text-lg font-bold text-slate-100 font-mono">
              ${accountInfo?.walletBalance !== undefined ? accountInfo.walletBalance.toFixed(2) : "0.00"}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Unrealized PnL</span>
            <span
              className={`text-lg font-bold font-mono ${
                (accountInfo?.unrealizedPnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {(accountInfo?.unrealizedPnl || 0) >= 0 ? "+" : ""}
              ${accountInfo?.unrealizedPnl !== undefined ? accountInfo.unrealizedPnl.toFixed(2) : "0.00"}
            </span>
          </div>
        </div>

        {/* Refresh & Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700 flex items-center space-x-1.5 text-xs"
            title="Fetch live balance directly from Binance Futures API"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh Balance</span>
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition border border-amber-500/30 text-xs font-semibold"
          >
            {showDetails ? "Hide Assets" : "Account Assets"}
          </button>
        </div>
      </div>

      {/* Error Banner & Actionable Fix Guidance */}
      {accountInfo?.error && (
        <div className="mt-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-rose-200 block text-sm mb-0.5">Binance API Notice</span>
              <p className="text-rose-300/90">{accountInfo.error}</p>
            </div>
          </div>

          {is401Error && (
            <div className="mt-3 pt-3 border-t border-rose-500/20 text-slate-200 font-sans space-y-2.5">
              <div className="flex items-center justify-between bg-slate-950/70 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-300 font-mono">
                  Cloud Server IP: <strong className="text-amber-300">{serverIp}</strong>
                </span>
                <button
                  onClick={handleCopyIp}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono transition"
                >
                  {copiedIp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIp ? "Copied IP!" : "Copy IP"}</span>
                </button>
              </div>

              <div className="space-y-1 text-xs text-slate-300">
                <p className="font-semibold text-amber-400">How to resolve this in 2 simple steps on Binance:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-300 text-[11px] leading-relaxed">
                  <li>
                    Go to <strong className="text-slate-100">Binance API Management</strong> (<a href="https://www.binance.com/en/my/settings/api-management" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center">Binance API Settings <ExternalLink className="w-3 h-3 ml-0.5 inline" /></a>).
                  </li>
                  <li>
                    Click <strong className="text-slate-100">Edit Restrictions</strong> on your API key:
                    <ul className="list-disc list-inside pl-4 mt-0.5 text-slate-400 space-y-0.5">
                      <li>Enable <strong className="text-emerald-300 font-mono">Enable Futures</strong> permission checkbox.</li>
                      <li>Under IP Access Restrictions, select <strong className="text-amber-300 font-mono">Restrict access to trusted IPs only</strong> and paste <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">{serverIp}</code> (or select "Unrestricted" if testing).</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assets & Open Positions Detail Drawer */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Asset Breakdown */}
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1">
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>Wallet Assets</span>
            </h4>
            {accountInfo?.assets && accountInfo.assets.length > 0 ? (
              <div className="space-y-1.5 text-xs font-mono">
                {accountInfo.assets.map((asset, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <span className="text-slate-300 font-bold">{asset.asset}</span>
                    <div className="text-right">
                      <span className="text-slate-100 font-semibold">${asset.walletBalance.toFixed(2)}</span>
                      <span className="text-slate-500 text-[10px] block">
                        Avail: ${asset.availableBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No positive asset balances returned from API.</p>
            )}
          </div>

          {/* Live Binance Positions */}
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>Binance Open Positions ({accountInfo?.positions?.length || 0})</span>
            </h4>
            {accountInfo?.positions && accountInfo.positions.length > 0 ? (
              <div className="space-y-1.5 text-xs font-mono">
                {accountInfo.positions.map((pos, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-800/50">
                    <div>
                      <span className="text-slate-100 font-bold">{pos.symbol}</span>
                      <span className="text-[10px] text-slate-400 block">
                        {pos.positionAmt > 0 ? "LONG" : "SHORT"} {pos.leverage}x
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold ${
                          pos.unrealizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {pos.unrealizedProfit >= 0 ? "+" : ""}
                        ${pos.unrealizedProfit.toFixed(2)}
                      </span>
                      <span className="text-slate-500 text-[10px] block">
                        Entry: ${pos.entryPrice.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No active positions currently open on Binance Futures.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

