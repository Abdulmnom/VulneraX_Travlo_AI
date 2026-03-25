"use client";

/**
 * MicPermissionAlert – Friendly modal shown when microphone access is denied
 *
 * Appears when:
 *  - SpeechRecognition returns "not-allowed" error
 *  - User tries to use mic and browser blocks it
 *
 * Guides the user step-by-step (Chrome / Edge / generic) to re-enable.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MicOff, X, ExternalLink } from "lucide-react";

interface MicPermissionAlertProps {
  open: boolean;
  language: "ar" | "en";
  onDismiss: () => void;
  onRetry: () => void;
}

const COPY = {
  en: {
    title: "Microphone Access Needed 🎤",
    subtitle: "Travlo needs your mic to hear you!",
    steps: [
      "Click the 🔒 lock icon in your browser's address bar",
      'Find "Microphone" and set it to "Allow"',
      "Refresh the page and try again",
    ],
    retry: "I've enabled it — Try again",
    dismiss: "Not now",
    tip: "Voice features work best in Chrome or Edge",
  },
  ar: {
    title: "نحتاج إذن المايك 🎤",
    subtitle: "ترافلو يحتاج مايكروفونك لسماعك!",
    steps: [
      "اضغط على أيقونة 🔒 في شريط العنوان",
      'ابحث عن "الميكروفون" واضبطه على "سماح"',
      "أعد تحميل الصفحة وحاول مجدداً",
    ],
    retry: "فعّلته — حاول مرة أخرى",
    dismiss: "ليس الآن",
    tip: "يعمل الصوت بشكل أفضل في Chrome أو Edge",
  },
};

export default function MicPermissionAlert({
  open,
  language,
  onDismiss,
  onRetry,
}: MicPermissionAlertProps) {
  const [mounted, setMounted] = useState(false);
  const copy = COPY[language];
  const isAr = language === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mic-alert-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-xl p-4"
          onClick={onDismiss}
          dir={isAr ? "rtl" : "ltr"}
        >
          <motion.div
            key="mic-alert-card"
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-red-500/20 bg-gradient-to-b from-[#1a0f0f] to-[#0b0f1a] shadow-[0_0_60px_rgba(239,68,68,0.1)] overflow-hidden"
          >
            {/* Red glow top */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-red-500/15 to-transparent pointer-events-none" />

            {/* Close */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 text-white/30 hover:text-white/70 z-10"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center gap-5 px-7 pt-9 pb-7">
              {/* Sad mic icon */}
              <motion.div
                animate={{ rotate: [-5, 5, -5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center"
              >
                <MicOff size={28} className="text-red-400" />
              </motion.div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-white font-bold text-lg">{copy.title}</h2>
                <p className="text-white/50 text-sm mt-1">{copy.subtitle}</p>
              </div>

              {/* Steps */}
              <div className="w-full space-y-2.5">
                {copy.steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isAr ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/8 px-3.5 py-2.5"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-400 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-white/70 text-sm">{step}</span>
                  </motion.div>
                ))}
              </div>

              {/* Tip */}
              <p className="text-white/30 text-xs text-center flex items-center gap-1.5">
                <ExternalLink size={11} />
                {copy.tip}
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-2 w-full">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onRetry}
                  className="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 py-3 text-white font-semibold text-sm transition-colors shadow-lg shadow-amber-500/20"
                >
                  {copy.retry}
                </motion.button>
                <button
                  onClick={onDismiss}
                  className="w-full rounded-2xl py-2.5 text-white/40 hover:text-white/70 text-sm transition-colors"
                >
                  {copy.dismiss}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
