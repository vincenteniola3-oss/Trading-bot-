import React, { useState } from "react";
import { X, Zap, ArrowUpRight, ArrowDownRight, ShieldCheck } from "lucide-react";

interface ManualTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteTrade: (
    symbol: string,
    side: "buy" | "sell",
    price: number,
    executionMode: "live",
    marginUsdt: number
  ) => void;
  availableSymbols?: string[];
  hasApiKey?: boolean;
}

export const ManualTradeModal: React.FC<ManualTradeModalProps> = ({
  isOpen,
  onClose,
  onExecuteTrade,
  availableSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "PEPEUSDT", "SUIUSDT", "NEARUSDT", "AVAXUSDT", "DOGEUSDT"],
  hasApiKey = true,
}) => {
  const [symbol, setSymbol] = useState("SOLUSDT");
  const [customSymbol, setCustomSymbol] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [priceInput, setPriceInput] = useState<string>("145.20");
  const [marginUsdt, setMarginUsdt] = useState<string>("1.00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSymbol = (customSymbol.trim() || symbol).toUpperCase();
    const parsedPrice = parseFloat(priceInput) || 100;
    const parsedMargin = parseFloat(marginUsdt) || 1.0;
    
    setIsSubmitting(true);
    onExecuteTrade(finalSymbol, side, parsedPrice, "live", parsedMargin);
    
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Execute Live Binance Trade</h3>
              <p className="text-xs text-emerald-400 font-medium flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Binance USD-M Futures • Live Order</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Live Order Badge */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-300">LIVE Binance Execution</p>
              <p className="text-[11px] text-slate-400">This order will submit a real MARKET order on your Binance USD-M Futures account.</p>
            </div>
          </div>

          {/* Side Toggle (LONG vs SHORT) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Trade Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide("buy")}
                className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border font-bold text-xs transition ${
                  side === "buy"
                    ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>LONG / BUY</span>
              </button>
              <button
                type="button"
                onClick={() => setSide("sell")}
                className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border font-bold text-xs transition ${
                  side === "sell"
                    ? "bg-rose-500 text-slate-950 border-rose-400 shadow-md shadow-rose-500/20"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>SHORT / SELL</span>
              </button>
            </div>
          </div>

          {/* Symbol Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Select Market Symbol
            </label>
            <select
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setCustomSymbol("");
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
            >
              {availableSymbols.map((s) => (
                <option key={s} value={s}>
                  {s} (Binance Perpetual)
                </option>
              ))}
            </select>
          </div>

          {/* Custom Symbol Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Or Custom Symbol (e.g. BTCUSDT)
            </label>
            <input
              type="text"
              placeholder="e.g. BTCUSDT"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono uppercase"
            />
          </div>

          {/* Margin & Price Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Position Margin ($ USDT)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={marginUsdt}
                onChange={(e) => setMarginUsdt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Entry Price ($ USDT)
              </label>
              <input
                type="number"
                step="any"
                required
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Position Info Box */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-400 font-mono">
            <div className="flex justify-between">
              <span>Account Margin Required:</span>
              <span className="text-slate-200 font-semibold">${parseFloat(marginUsdt || "0").toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span>Notional Position Value (20x):</span>
              <span className="text-emerald-400 font-semibold">${(parseFloat(marginUsdt || "0") * 20).toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span>Exit Rule:</span>
              <span className="text-sky-300 font-semibold">EOD 00:00 UTC / Manual</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg ${
                side === "buy"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20"
                  : "bg-rose-500 hover:bg-rose-600 text-slate-950 shadow-rose-500/20"
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{isSubmitting ? "Executing Trade..." : "Execute Trade"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
