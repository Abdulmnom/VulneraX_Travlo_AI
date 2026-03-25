"use client";

/**
 * WakeWordModal – Dramatic animated modal shown when wake word is detected
 *
 * Shows:
 *  • Pulsing amber mic orb
 *  • Animated waveform bars
 *  • The detected phrase
 *  • "Now listening…" state that transitions to "Processing…" when voice captured
 *  • Auto-dismisses when voice input completes
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X } from "lucide-react";

// Pre-calculated waveform bar heights to avoid hydration issues
const WAVE_HEIGHTS = [14, 32, 22, 44, 18, 38, 26, 48, 20, 36, 16, 42, 24];

interface WakeWordModalProps {
  open: boolean;
  detectedPhrase: string;
  language: "ar" | "en";
  onDismiss: () => void;
}

const COPY = {
  en: {
    heard: "I heard you! 👋",
    listening: "🎙️ Now listening…",
    tip: "Speak your question now",
    dismiss: "Cancel",
  },
  ar: {
    heard: "سمعتك! 👋",
    listening: "🎙️ الآن أستمع…",
    tip: "تحدث الآن بسؤالك",
    dismiss: "إلغاء",
  },
};

export default function WakeWordModal({
  open,
  detectedPhrase,
  language,
  onDismiss,
}: WakeWordModalProps) {
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
          key="wake-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xl p-4"
          onClick={onDismiss}
          dir={isAr ? "rtl" : "ltr"}
        >
          <motion.div
            key="wake-card"
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-white/15 bg-gradient-to-b from-[#12182b] to-[#0b0f1a] shadow-[0_0_80px_rgba(245,158,11,0.15)] overflow-hidden"
          >
            {/* Amber glow top */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/20 to-transparent pointer-events-none" />

            {/* Dismiss button */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors z-10"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center gap-5 px-8 pt-10 pb-8">
              {/* Pulsing mic orb */}
              <div className="relative flex items-center justify-center">
                {/* Outer rings */}
                {[1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute rounded-full border border-amber-400/30"
                    style={{ width: 72 + i * 24, height: 72 + i * 24 }}
                    animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: "easeInOut",
                    }}
                  />
                ))}
                {/* Core orb */}
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 20px rgba(245,158,11,0.4)",
                      "0 0 40px rgba(245,158,11,0.7)",
                      "0 0 20px rgba(245,158,11,0.4)",
                    ],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl"
                >
                  <Mic size={30} className="text-white" />
                </motion.div>
              </div>

              {/* Headline */}
              <div className="text-center">
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-white font-bold text-xl"
                >
                  {copy.heard}
                </motion.p>
              </div>

              {/* Detected phrase pill */}
              {detectedPhrase && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                  className="flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-5 py-2"
                >
                  <span className="text-xs text-white/40 uppercase tracking-wider">
                    {isAr ? "سمعت" : "Heard"}
                  </span>
                  <span className="text-amber-300 font-semibold text-sm">
                    &ldquo;{detectedPhrase}&rdquo;
                  </span>
                </motion.div>
              )}

              {/* Waveform */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-[3px] h-12"
              >
                {WAVE_HEIGHTS.map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full bg-gradient-to-t from-amber-600 to-amber-300"
                    animate={{ height: [6, h, 6] }}
                    transition={{
                      duration: 0.5 + (i % 3) * 0.15,
                      repeat: Infinity,
                      delay: i * 0.06,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </motion.div>

              {/* Status text */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-center space-y-1"
              >
                <p className="text-amber-300 font-medium text-base">
                  {copy.listening}
                </p>
                <p className="text-white/40 text-xs">{copy.tip}</p>
              </motion.div>

              {/* Dismiss button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                onClick={onDismiss}
                className="mt-1 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-6 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                {copy.dismiss}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
