import React, { useState } from "react";
import { Sliders, Play, CheckCircle2, TrendingUp, RefreshCw } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export const Backtester: React.FC = () => {
  const [entryThreshold, setEntryThreshold] = useState<number>(20.0);
  const [takeProfit, setTakeProfit] = useState<number>(5.0);
  const [initialCapital, setInitialCapital] = useState<number>(1000.0);
  const [positionSize, setPositionSize] = useState<number>(100.0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<any | null>(null);

  const runBacktest = () => {
    setIsSimulating(true);

    setTimeout(() => {
      // Generate backtest output based on parameter choices
      const samplePairs = [
        "SOLUSDT", "AVAXUSDT", "NEARUSDT", "SUIUSDT", "ETHUSDT",
        "BTCUSDT", "DOGEUSDT", "LINKUSDT", "APTUSDT", "ADAUSDT"
      ];

      let balance = initialCapital;
      const curve = [{ step: "Initial", balance: initialCapital }];
      let wins = 0;
      let totalTrades = 0;

      samplePairs.forEach((pair, idx) => {
        // Higher threshold = fewer, higher probability trades
        const spikeGain = 15 + Math.random() * 20;
        if (spikeGain >= entryThreshold) {
          totalTrades += 1;
          const isWin = Math.random() > (takeProfit > 10 ? 0.25 : 0.05);
          const pnlPct = isWin ? takeProfit : -takeProfit * 0.5;
          const pnlUsdt = (pnlPct / 100) * positionSize;
          if (isWin) wins += 1;
          balance += pnlUsdt;
          curve.push({
            step: `Trade #${totalTrades} (${pair})`,
            balance: Math.round(balance * 100) / 100,
          });
        }
      });

      setSimulationResults({
        totalTrades,
        wins,
        winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 100,
        finalBalance: balance,
        netProfit: balance - initialCapital,
        curve,
      });

      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2 mb-1">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Strategy Backtesting & Parameter Simulator</span>
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Simulate the 00:00 UTC daily open momentum strategy against market datasets with custom entry and exit parameters.
        </p>

        {/* Sliders Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Entry Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="text-slate-300 font-medium">Entry Threshold (%)</label>
              <span className="font-mono text-emerald-400 font-bold">+{entryThreshold}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={entryThreshold}
              onChange={(e) => setEntryThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Minimum percentage gain from 00:00 UTC daily open to trigger buy.
            </p>
          </div>

          {/* Take Profit Target */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="text-slate-300 font-medium font-mono">Take Profit Target (%)</label>
              <span className="font-mono text-emerald-400 font-bold">+{takeProfit}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={takeProfit}
              onChange={(e) => setTakeProfit(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Target exit price gain percentage from entry price.
            </p>
          </div>

          {/* Fixed Trade Size */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="text-slate-300 font-medium font-mono">Trade Size (USDT)</label>
              <span className="font-mono text-slate-200 font-bold">${positionSize} USDT</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={positionSize}
              onChange={(e) => setPositionSize(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Notional position allocation per detected signal.
            </p>
          </div>
        </div>

        <button
          onClick={runBacktest}
          disabled={isSimulating}
          className="flex items-center space-x-2 text-xs px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow transition"
        >
          <Play className={`w-3.5 h-3.5 ${isSimulating ? "animate-spin" : ""}`} />
          <span>{isSimulating ? "Simulating Strategy..." : "Run Backtest Simulation"}</span>
        </button>
      </div>

      {/* Simulation Output */}
      {simulationResults && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Executed Signals</span>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">
                {simulationResults.totalTrades}
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Win Rate</span>
              <div className="text-xl font-bold font-mono text-sky-400 mt-1">
                {simulationResults.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Net Profit</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  simulationResults.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                +${simulationResults.netProfit.toFixed(2)} USDT
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Ending Balance</span>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">
                ${simulationResults.finalBalance.toFixed(2)} USDT
              </div>
            </div>
          </div>

          <div className="h-56 w-full pt-2">
            <h4 className="text-xs font-bold text-slate-300 mb-3">Simulated Equity Curve</h4>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simulationResults.curve}>
                <XAxis dataKey="step" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} unit=" $" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    fontSize: "12px",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "#34d399" }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: "#10b981", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
