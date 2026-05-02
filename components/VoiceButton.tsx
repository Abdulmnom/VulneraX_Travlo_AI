"use client";

/**
 * VoiceButton – Presentational mic button with waveform visualization
 *
 * Props:
 *   isRecording  – show red recording state with pulsing rings
 *   isProcessing – show spinner
 *   audioLevel   – 0–1 for dynamic pulse scale
 *   onClick      – toggle recording
 *   disabled     – disable interaction
 */

import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceButtonProps {
  language: "ar" | "en";
  isRecording?: boolean;
  isProcessing?: boolean;
  audioLevel?: number;
  onClick?: () => void;
  disabled?: boolean;
}

const LABELS = {
  en: {
    idle: "Start voice input",
    recording: "Listening… tap to stop",
    processing: "Thinking…",
  },
  ar: {
    idle: "بدء الإدخال الصوتي",
    recording: "جارٍ الاستماع… اضغط للإيقاف",
    processing: "جارٍ التفكير…",
  },
};

export default function VoiceButton({
  language,
  isRecording = false,
  isProcessing = false,
  audioLevel = 0,
  onClick,
  disabled = false,
}: VoiceButtonProps) {
  const labels = LABELS[language];
  const state = isRecording ? "recording" : isProcessing ? "processing" : "idle";
  const pulseScale = isRecording ? 1 + audioLevel * 0.4 : 1;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || isProcessing}
      whileTap={{ scale: 0.92 }}
      title={labels[state]}
      aria-label={labels[state]}
      className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
        isRecording
          ? "bg-red-500 hover:bg-red-600"
          : isProcessing
          ? "bg-violet-500"
          : "bg-amber-500 hover:bg-amber-400"
      }`}
    >
      <AnimatePresence>
        {isRecording && (
          <>
            <motion.span
              key="ring1"
              className="absolute inset-0 rounded-full bg-red-500"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              key="ring2"
              className="absolute inset-0 rounded-full bg-red-500"
              initial={{ scale: 1, opacity: 0.3 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            />
            <motion.span
              key="level-ring"
              className="absolute inset-0 rounded-full bg-red-400"
              animate={{ scale: pulseScale, opacity: 0.2 + audioLevel * 0.3 }}
              transition={{ duration: 0.1 }}
            />
          </>
        )}
      </AnimatePresence>

      {disabled ? (
        <Loader2 size={20} className="animate-spin text-white" />
      ) : isProcessing ? (
        <Loader2 size={20} className="text-white animate-spin" />
      ) : isRecording ? (
        <MicOff size={20} className="text-white" />
      ) : (
        <Mic size={20} className="text-white" />
      )}
    </motion.button>
  );
}
