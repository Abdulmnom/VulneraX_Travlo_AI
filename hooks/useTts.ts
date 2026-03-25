"use client";

/**
 * useTts – Text-to-Speech hook using the Web Speech API
 *
 * Reads AI recommendation responses aloud in the correct language.
 * - Cancels any ongoing utterance before starting a new one.
 * - Adjusts voice, rate, and pitch per language.
 * - Exposes `isSpeaking` so the UI can show a stop button.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useTts(language: "ar" | "en") {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (!text.trim()) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "ar" ? "ar-SA" : "en-US";
      utterance.rate = language === "ar" ? 0.85 : 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [language]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
