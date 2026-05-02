"use client";

/**
 * useVoiceAssistant – Orchestrator for the full voice interaction flow
 *
 * Flow:
 *   1. Start recording (useVoiceRecorder) + browser SpeechRecognition in parallel
 *   2. Stop → if browser STT has a transcript, send it as text (skips server STT)
 *              otherwise fall back to sending the audio blob for server-side STT
 *   3. Receive JSON → call onResult (page injects messages + speaks response)
 *
 * Returns:
 *   - isProcessing (recording OR sending)
 *   - audioLevel (0–1 for waveform)
 *   - start() / stop()
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "./useVoiceRecorder";
import type { ConversationTurn, Recommendation } from "@/lib/ollama";

export interface VoiceAssistantResult {
  transcript: string;
  response: string;
  recommendations: Recommendation[];
  provider: string;
  language: "ar" | "en";
  source: "local" | "fallback";
  latency_ms: number;
}

interface UseVoiceAssistantOptions {
  language: "ar" | "en";
  /** Conversation history to send for context-aware responses */
  history?: ConversationTurn[];
  onResult: (result: VoiceAssistantResult) => void;
  onError?: (message: string) => void;
  /** Auto-stop recording after this many ms (default 10 s) */
  autoStopMs?: number;
}

export function useVoiceAssistant({
  language,
  history = [],
  onResult,
  onError,
  autoStopMs = 10_000,
}: UseVoiceAssistantOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { isRecording, audioLevel, start: startRecording, stop: stopRecording, blob } =
    useVoiceRecorder();

  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  // Keep a ref to the latest history so the send effect always sees fresh data
  const historyRef = useRef<ConversationTurn[]>(history);
  historyRef.current = history;

  // Browser SpeechRecognition refs
  const srRef = useRef<SpeechRecognition | null>(null);
  const browserTranscriptRef = useRef<string>("");

  isProcessingRef.current = isProcessing;

  // ── Auto-stop timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording && autoStopMs) {
      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, autoStopMs);
    }
    return () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    };
  }, [isRecording, autoStopMs, stopRecording]);

  // ── Send blob/transcript to server once recording stops ────────────────────
  useEffect(() => {
    if (!blob || isRecording) return;

    const send = async () => {
      setIsProcessing(true);
      try {
        const formData = new FormData();

        // Stop SpeechRecognition and collect its transcript
        if (srRef.current) {
          try { srRef.current.stop(); } catch { /* ignore */ }
          srRef.current = null;
        }

        const browserTranscript = browserTranscriptRef.current.trim();

        if (browserTranscript.length >= 2) {
          // ✅ Browser STT succeeded — send transcript directly (skips server STT)
          formData.append("transcript", browserTranscript);
        } else {
          // ⚠️ No browser transcript — fall back to sending audio blob for server STT
          formData.append("audio", blob, "recording.webm");
        }

        // Include last 10 turns of history for context-aware LLM responses
        const recentHistory = historyRef.current.slice(-10);
        if (recentHistory.length > 0) {
          formData.append("history", JSON.stringify(recentHistory));
        }

        const res = await fetch("/api/voice-assistant", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error ${res.status}`);
        }

        const data = await res.json();
        onResult({
          transcript: data.transcript,
          response: data.response,
          recommendations: data.recommendations ?? [],
          provider: data.provider,
          language: data.language,
          source: data.source,
          latency_ms: data.latency_ms,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Voice assistant failed";
        console.error("[useVoiceAssistant] Error:", msg);
        onError?.(msg);
      } finally {
        setIsProcessing(false);
      }
    };

    send();
  }, [blob, isRecording, onResult, onError]);

  const start = useCallback(() => {
    if (isProcessingRef.current) return;

    // Reset browser transcript for new recording
    browserTranscriptRef.current = "";

    // Start browser SpeechRecognition if available
    const SpeechRecognitionAPI =
      (typeof window !== "undefined" &&
        (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition)) ||
      null;

    if (SpeechRecognitionAPI) {
      try {
        const sr = new SpeechRecognitionAPI() as SpeechRecognition;
        sr.lang = language === "ar" ? "ar-SA" : "en-US";
        sr.continuous = true;
        sr.interimResults = false;
        sr.maxAlternatives = 1;

        sr.onresult = (event: SpeechRecognitionEvent) => {
          const newParts = Array.from(event.results)
            .slice(event.resultIndex)
            .map((r) => r[0].transcript)
            .join(" ");
          browserTranscriptRef.current += (browserTranscriptRef.current ? " " : "") + newParts;
        };

        sr.onerror = (event: Event) => {
          // network or no-speech errors are non-fatal — audio blob fallback will be used
          console.warn("[useVoiceAssistant] SpeechRecognition error:", (event as any).error);
        };

        sr.start();
        srRef.current = sr;
      } catch (e) {
        console.warn("[useVoiceAssistant] SpeechRecognition unavailable:", e);
        srRef.current = null;
      }
    }

    startRecording();
  }, [startRecording, language]);

  const stop = useCallback(() => {
    stopRecording();
    // SpeechRecognition.stop() is called in the send effect once blob is ready
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (srRef.current) {
        try { srRef.current.abort(); } catch { /* ignore */ }
        srRef.current = null;
      }
    };
  }, []);

  return {
    isProcessing: isRecording || isProcessing,
    isRecording,
    audioLevel,
    start,
    stop,
  };
}
