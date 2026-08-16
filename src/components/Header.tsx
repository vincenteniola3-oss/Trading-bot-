import React from "react";
import {
  Play,
  Square,
  Activity,
  Code2,
  SlidersHorizontal,
  FileCode2,
  Terminal,
  Cpu,
  ShieldCheck,
  RotateCw,
  BarChart3,
  Database,
  Flame,
  RotateCcw,
  Zap,
} from "lucide-react";
import { TestStatus, BotStatus } from "../types";

interface HeaderProps {
  status: BotStatus | null;
  testStatus?: TestStatus | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onStartBot: () => void;
  onStopBot: () => void;
  onResetBot: () => void;
  onRunTests: () => void;
  onOpenTestModal: () => void;
  onOpenManualTradeModal?: () => void;
  onSimulateSignal?: (symbol?: string) => void;
  isTesting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  testStatus,
  activeTab,
  setActiveTab,
  onStartBot,
  onStopBot,
  onResetBot,
  onRunTests,
  onOpenTestModal,
  onOpenManualTradeModal,
  onSimulateSignal,
  isTesting,
}) => {
  const isRunning = status?.isRunning ?? false;

  const navItems = [
    { id: "dashboard", label: "Live Dashboard", icon: Activity },
    { id: "radar", label: "Binance Market Radar", icon: BarChart3 },
    { id: "positions", label: "Active Positions & History", icon: Cpu },
    { id: "logs", label: "Live Engine Logs", icon: Terminal },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Bot Badge */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  Cryptocurrency Trading Bot
                </h1>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                  Binance Market Only
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Binance USDT Perpetual Futures (20x Leverage • $1/Position • EOD Auto-Close • Dynamic Balance Tiers)
              </p>
            </div>
          </div>

          {/* Controls & Status */}
          <div className="flex items-center space-x-3">
            {/* Live Status Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isRunning
                    ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {isRunning ? "Engine Online" : "Engine Idle"}
              </span>
              {status?.testnet && (
                <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono">
                  Testnet
                </span>
              )}
              <span className="hidden md:flex items-center space-x-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono" title="State, active positions, and trade history are automatically saved to disk">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>24/7 Disk Saved</span>
              </span>
              <span className="hidden lg:flex items-center space-x-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono" title="Connected to Firebase Firestore Cloud Database">
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Firebase Cloud Sync</span>
              </span>
              <span className="hidden xl:flex items-center space-x-1 text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono" title="Connected to Google Cloud SQL PostgreSQL Database">
                <Database className="w-3 h-3 text-sky-400" />
                <span>Cloud SQL Active</span>
              </span>
            </div>

            {/* Test Trade Button */}
            {onSimulateSignal && (
              <button
                onClick={() => onSimulateSignal("SOLUSDT")}
                title="Simulate a fresh +24.5% surge crossing event to test bot auto-execution and performance"
                className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition font-semibold shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>Run Test Trade (+24%)</span>
              </button>
            )}

            {/* Manual Trade Button */}
            {onOpenManualTradeModal && (
              <button
                onClick={onOpenManualTradeModal}
                title="Execute a manual trade on any Binance pair"
                className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition font-medium"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>Manual Trade</span>
              </button>
            )}

            {/* Reset Bot Button */}
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to reset the bot state? This will clear all active positions, history, and pair locks.")) {
                  onResetBot();
                }
              }}
              title="Reset bot state (Clears all active positions, history, and pair locks)"
              className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>

            {/* Start / Stop Toggle Button */}
            {isRunning ? (
              <button
                onClick={onStopBot}
                className="flex items-center space-x-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-medium transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Bot</span>
              </button>
            ) : (
              <button
                onClick={onStartBot}
                className="flex items-center space-x-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Bot</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none border-t border-slate-800 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
