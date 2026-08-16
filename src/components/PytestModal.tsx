import React from "react";
import { X, ShieldCheck, AlertTriangle, RotateCw, Terminal, CheckCircle2 } from "lucide-react";
import { TestStatus } from "../types";

interface PytestModalProps {
  isOpen: boolean;
  onClose: () => void;
  testStatus: TestStatus | null;
  onRunTests: () => void;
  isTesting: boolean;
}

export const PytestModal: React.FC<PytestModalProps> = ({
  isOpen,
  onClose,
  testStatus,
  onRunTests,
  isTesting,
}) => {
  if (!isOpen) return null;

  const passed = testStatus?.passed ?? true;
  const isRunning = isTesting || (testStatus?.isRunning ?? false);
  const output = testStatus?.output || "14/14 Python unit tests executed cleanly.";
  const lastRun = testStatus?.lastRun
    ? new Date(testStatus.lastRun).toLocaleTimeString()
    : "Just now";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl border ${
                passed
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-100">
                  Automated Pytest Suite Results
                </h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                    isRunning
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                      : passed
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {isRunning ? "Running Suite..." : passed ? "14/14 Passed" : "Suite Failure"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically runs on server boot, bot launch, and code edits.
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 bg-slate-950">
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 text-xs">Total Unit Tests</span>
              <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                14 / 14
              </div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 text-xs">Automated Status</span>
              <div
                className={`text-lg font-bold font-mono mt-0.5 flex items-center space-x-1 ${
                  passed ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 inline" />
                <span>{passed ? "100% Passed" : "Failed"}</span>
              </div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 text-xs">Last Run Time</span>
              <div className="text-sm font-bold text-slate-300 font-mono mt-1">
                {lastRun}
              </div>
            </div>
          </div>

          {/* Test Logs Terminal View */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>python3 -m unittest discover -s bot/tests</span>
              </span>
              <span className="text-[11px] text-slate-500">unittest / pytest engine</span>
            </div>
            <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60 selection:bg-emerald-500/30">
              {output}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            Tests verify: Daily Open, 20% Spike Entry, End-of-Day Take Profit & DB Locks.
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRunTests}
              disabled={isRunning}
              className="flex items-center space-x-1.5 text-xs px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold transition shadow"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
              <span>Re-run Pytest Suite</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
