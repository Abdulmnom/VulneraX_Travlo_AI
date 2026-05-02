"use client";

/**
 * useTts – Text-to-Speech hook
 *
 * Primary:  Web Speech API (window.speechSynthesis)
 * Fallback: /api/tts (Google Cloud TTS) when:
 *   - speechSynthesis is unavailable, OR
 *   - no voice is available for the requested language (common for Arabic on
 *     Windows/Android where ar-SA voices are absent)
 *
 * Fallback audio is decoded from base64 and played via an <Audio> element.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Cache: language → whether a matching voice was found (avoids repeated scans)
const voiceAvailabilityCache = new Map<string, boolean>();

/**
 * Check if the browser has a voice for the given BCP-47 language tag.
 * Uses a small allowance: if any voice *starts with* the language prefix we
 * consider it available (e.g. "ar" matches "ar-SA", "ar-EG", …).
 */
function hasVoiceForLang(lang: string): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  if (voiceAvailabilityCache.has(lang)) return voiceAvailabilityCache.get(lang)!;

  const prefix = lang.split("-")[0].toLowerCase();
  const found = window.speechSynthesis
    .getVoices()
    .some((v) => v.lang.toLowerCase().startsWith(prefix));

  // Only cache a positive result; a negative result may be a timing issue
  // (voices load asynchronously on first call).
  if (found) voiceAvailabilityCache.set(lang, true);
  return found;
}

/**
 * Play base64-encoded MP3 audio returned by /api/tts.
 */
async function playBase64Audio(base64: string, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: contentType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Audio playback failed"));
    };
    audio.play().catch(reject);
  });
}

export function useTts(language: "ar" | "en") {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      abortRef.current = false;
      window.speechSynthesis?.cancel();

      const langCode = language === "ar" ? "ar-SA" : "en-US";
      const hasBrowserVoice =
        typeof window !== "undefined" &&
        !!window.speechSynthesis &&
        hasVoiceForLang(langCode);

      // ── Primary: Web Speech API ──────────────────────────────────────────
      if (hasBrowserVoice) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = language === "ar" ? 0.85 : 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 1;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = async (e) => {
          setIsSpeaking(false);
          // On error fall through to API fallback
          if (!abortRef.current) {
            await speakViaApi(text);
          }
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        return;
      }

      // ── Fallback: /api/tts (Google Cloud TTS) ───────────────────────────
      await speakViaApi(text);
    },
    [language] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Call /api/tts and play the returned audio.
   */
  const speakViaApi = useCallback(
    async (text: string) => {
      if (abortRef.current) return;
      setIsSpeaking(true);
      try {
        // Truncate at last sentence boundary to stay under the 1500-char server limit
        let ttsText = text;
        if (ttsText.length > 1400) {
          const cut = ttsText.lastIndexOf(".", 1400);
          ttsText = cut > 100 ? ttsText.slice(0, cut + 1) : ttsText.slice(0, 1400);
        }

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, language }),
        });
        if (!res.ok) throw new Error(`/api/tts returned ${res.status}`);
        const { audioBase64, contentType } = await res.json();
        if (!abortRef.current) {
          await playBase64Audio(audioBase64, contentType ?? "audio/mp3");
        }
      } catch (err) {
        console.error("[useTts] API TTS failed:", err);
      } finally {
        setIsSpeaking(false);
      }
    },
    [language]
  );

  const stop = useCallback(() => {
    abortRef.current = true;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
