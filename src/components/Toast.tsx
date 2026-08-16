import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case "success":
        return {
          bg: "bg-emerald-950/90 border-emerald-500/40 text-emerald-200",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
        };
      case "error":
        return {
          bg: "bg-rose-950/90 border-rose-500/40 text-rose-200",
          icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
        };
      default:
        return {
          bg: "bg-slate-900/90 border-slate-700 text-slate-200",
          icon: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
        };
    }
  };

  const style = getStyle();

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-2 ${style.bg}`}
    >
      <div className="flex items-center space-x-3 pr-2">
        {style.icon}
        <p className="text-xs font-medium leading-snug">{toast.text}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800/50 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
