"use client";

/**
 * VoiceButton – Web Speech API microphone input
 *
 * Captures voice in Arabic or English, converts to text, and calls onResult.
 * Falls back gracefully to a disabled button if the browser doesn't support
 * the SpeechRecognition API (which is most non-Chromium browsers).
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceButtonProps {
  language: "ar" | "en";
  onResult: (transcript: string) => void;
  disabled?: boolean;
}

export default function VoiceButton({
  language,
  onResult,
  disabled = false,
}: VoiceButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check browser support
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
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [language, onResult]);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.abort();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        title="Voice input not supported in this browser"
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-white/10 cursor-not-allowed opacity-50"
      >
        <MicOff size={22} className="text-white/60" />
      </button>
    );
  }

  return (
    <motion.button
      onClick={toggle}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      title={isListening ? "Stop listening" : "Start voice input"}
      className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
        isListening
          ? "bg-red-500 hover:bg-red-600"
          : "bg-amber-500 hover:bg-amber-400"
      }`}
    >
      {/* Pulsing ring when active */}
      <AnimatePresence>
        {isListening && (
          <>
            <motion.span
              key="ring1"
              className="absolute inset-0 rounded-full bg-red-500 opacity-50"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              key="ring2"
              className="absolute inset-0 rounded-full bg-red-500 opacity-30"
              initial={{ scale: 1, opacity: 0.3 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.3,
              }}
            />
          </>
        )}
      </AnimatePresence>

      {disabled ? (
        <Loader2 size={22} className="animate-spin text-white" />
      ) : isListening ? (
        <MicOff size={22} className="text-white" />
      ) : (
        <Mic size={22} className="text-white" />
      )}
    </motion.button>
  );
}
