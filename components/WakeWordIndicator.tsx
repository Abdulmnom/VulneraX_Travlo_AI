"use client";

/**
 * WakeWordIndicator – Header badge showing wake-word status
 *
 * Shows a pulsing green dot when wake-word detection is active.
 * Tapping it toggles the feature on/off.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

interface WakeWordIndicatorProps {
  enabled: boolean;
  isActive: boolean; // is the background recognition running?
  language: "ar" | "en";
  onToggle: () => void;
}

const LABELS = {
  en: { on: 'Say "Hello Travlo" to activate mic', off: "Wake word disabled" },
  ar: { on: 'قل "مرحبا ترافلو" لتشغيل المايك', off: "كلمة التنشيط معطّلة" },
};

export default function WakeWordIndicator({
  enabled,
  isActive,
  language,
  onToggle,
}: WakeWordIndicatorProps) {
  const label = LABELS[language][enabled ? "on" : "off"];

  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
      title={label}
      aria-label={label}
      className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors border ${
        enabled
          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
          : "bg-white/5 border-white/15 text-white/40 hover:bg-white/10 hover:text-white/60"
      }`}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2">
        <AnimatePresence>
          {enabled && isActive && (
            <motion.span
              key="ping"
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            enabled && isActive ? "bg-emerald-400" : "bg-white/20"
          }`}
        />
      </span>

      {/* Icon */}
      {enabled ? (
        <Mic size={12} />
      ) : (
        <MicOff size={12} />
      )}

      {/* Text label — hidden on mobile */}
      <span className="hidden sm:block">
        {enabled ? (language === "ar" ? "التنشيط بالصوت" : "Wake Word") : language === "ar" ? "معطّل" : "Off"}
      </span>
    </motion.button>
  );
}
