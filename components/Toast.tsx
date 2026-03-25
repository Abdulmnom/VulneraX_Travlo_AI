"use client";

/**
 * Toast – Lightweight animated notification
 *
 * Usage:
 *   const { toast, showToast } = useToast();
 *   showToast("🎙️ Listening…");
 *   return <Toast toast={toast} />;
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ToastState {
  id: number;
  message: string;
  type: "info" | "success" | "warning";
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterRef = useRef(0);

  const showToast = useCallback(
    (message: string, type: ToastState["type"] = "info", durationMs = 3000) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      counterRef.current += 1;
      setToast({ id: counterRef.current, message, type });
      timerRef.current = setTimeout(() => setToast(null), durationMs);
    },
    []
  );

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}

interface ToastProps {
  toast: ToastState | null;
}

const TYPE_STYLES: Record<ToastState["type"], string> = {
  info: "bg-white/10 border-white/20 text-white",
  success: "bg-emerald-500/20 border-emerald-400/30 text-emerald-200",
  warning: "bg-amber-500/20 border-amber-400/30 text-amber-200",
};

export default function Toast({ toast }: ToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur-xl ${TYPE_STYLES[toast.type]}`}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
