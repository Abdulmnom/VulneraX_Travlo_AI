"use client";

/**
 * VoiceButton – Web Speech API microphone input + AI transcript enhancement
 *
 * Flow:
 *   1. User taps (or triggerKey changes) → SpeechRecognition listens
 *   2. Raw transcript → POST /api/voice-enhance (Ollama cleans it)
 *   3. Cleaned text → onResult callback
 *   4. Parent auto-submits the clean message
 *
 * Props:
 *   triggerKey   – increment this number to programmatically start listening
 *                  (used by wake-word detection)
 *   autoStopMs   – if set, mic auto-stops after this many ms of silence
 *
 * States:  idle → listening → enhancing → idle
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";

type VoiceState = "idle" | "listening" | "enhancing";

interface VoiceButtonProps {
  language: "ar" | "en";
  onResult: (transcript: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  disabled?: boolean;
  triggerKey?: number;   // increment to start listening programmatically
  autoStopMs?: number;   // auto-stop after N ms (e.g. 10_000)
}

const LABELS = {
  en: {
    idle: "Start voice input",
    listening: "Listening… tap to stop",
    enhancing: "Improving your input…",
    unsupported: "Voice input not supported in this browser",
  },
  ar: {
    idle: "بدء الإدخال الصوتي",
    listening: "جارٍ الاستماع… اضغط للإيقاف",
    enhancing: "جارٍ تحسين الإدخال…",
    unsupported: "الإدخال الصوتي غير مدعوم في هذا المتصفح",
  },
};

export default function VoiceButton({
  language,
  onResult,
  onListeningChange,
  disabled = false,
  triggerKey,
  autoStopMs,
}: VoiceButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labels = LABELS[language];

  // Notify parent when listening state changes
  useEffect(() => {
    onListeningChange?.(voiceState === "listening");
  }, [voiceState, onListeningChange]);

  // ── Auto-stop timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (voiceState === "listening" && autoStopMs) {
      autoStopTimerRef.current = setTimeout(() => {
        recognitionRef.current?.stop();
      }, autoStopMs);
    }
    return () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    };
  }, [voiceState, autoStopMs]);

  // ── Enhance transcript via server ─────────────────────────────────────────
  const enhance = useCallback(
    async (raw: string) => {
      setVoiceState("enhancing");
      try {
        const res = await fetch("/api/voice-enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: raw }),
        });
        if (res.ok) {
          const data = await res.json();
          onResult(data.enhanced || raw);
        } else {
          onResult(raw);
        }
      } catch {
        onResult(raw);
      } finally {
        setVoiceState("idle");
      }
    },
    [onResult]
  );

  // ── SpeechRecognition setup ───────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === "ar" ? "ar-OM" : "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      const transcript = event.results[0][0].transcript;
      enhance(transcript);
    };

    recognition.onerror = () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      setVoiceState("idle");
    };

    recognition.onend = () => {
      setVoiceState((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [language, enhance]);

  // ── Programmatic trigger (wake word) ─────────────────────────────────────
  useEffect(() => {
    if (!triggerKey || !recognitionRef.current) return;
    if (voiceState !== "idle") return;
    try {
      recognitionRef.current.start();
      setVoiceState("listening");
    } catch {
      /* already running */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  // ── Manual toggle ─────────────────────────────────────────────────────────
  const toggle = () => {
    if (!recognitionRef.current || voiceState === "enhancing") return;
    if (voiceState === "listening") {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      recognitionRef.current.stop();
      setVoiceState("idle");
    } else {
      try {
        recognitionRef.current.start();
        setVoiceState("listening");
      } catch {
        /* already started */
      }
    }
  };

  // ── Unsupported fallback ──────────────────────────────────────────────────
  if (!isSupported) {
    return (
      <button
        disabled
        title={labels.unsupported}
        className="flex items-center justify-center w-11 h-11 rounded-full bg-white/10 cursor-not-allowed opacity-40"
      >
        <MicOff size={20} className="text-white/60" />
      </button>
    );
  }

  const isListening = voiceState === "listening";
  const isEnhancing = voiceState === "enhancing";

  return (
    <motion.button
      onClick={toggle}
      disabled={disabled || isEnhancing}
      whileTap={{ scale: 0.92 }}
      title={labels[voiceState]}
      aria-label={labels[voiceState]}
      className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
        isListening
          ? "bg-red-500 hover:bg-red-600"
          : isEnhancing
          ? "bg-violet-500"
          : "bg-amber-500 hover:bg-amber-400"
      }`}
    >
      {/* Pulsing rings when listening */}
      <AnimatePresence>
        {isListening && (
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
          </>
        )}

        {/* Sparkle ring when enhancing */}
        {isEnhancing && (
          <motion.span
            key="enhance-ring"
            className="absolute inset-0 rounded-full border-2 border-violet-400"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      {disabled ? (
        <Loader2 size={20} className="animate-spin text-white" />
      ) : isEnhancing ? (
        <Sparkles size={20} className="text-white animate-pulse" />
      ) : isListening ? (
        <MicOff size={20} className="text-white" />
      ) : (
        <Mic size={20} className="text-white" />
      )}
    </motion.button>
  );
}
