import React from "react";
import { Terminal, Trash2, RefreshCw } from "lucide-react";

interface ConsoleLogsProps {
  logs: string[];
  onRefresh: () => void;
}

export const ConsoleLogs: React.FC<ConsoleLogsProps> = ({ logs, onRefresh }) => {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm flex flex-col h-[550px]">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Python Runtime Terminal & Execution Log Stream</span>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh Terminal</span>
        </button>
      </div>

      <div className="flex-1 p-4 bg-slate-950 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 select-text">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">No output logs recorded yet...</div>
        ) : (
          logs.map((log, idx) => {
            const isError = log.includes("[ERR]") || log.includes("ERROR");
            const isSignal = log.includes("TRIGGER") || log.includes("Signal");
            const isTest = log.includes("[TEST]");

            return (
              <div
                key={idx}
                className={`leading-relaxed break-all ${
                  isError
                    ? "text-rose-400"
                    : isSignal
                    ? "text-amber-300 font-semibold"
                    : isTest
                    ? "text-sky-300"
                    : "text-slate-300"
                }`}
              >
                {log}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
