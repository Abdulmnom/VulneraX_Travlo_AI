"use client";

/**
 * useWakeWord – Reliable background wake-word detector (v2)
 *
 * Uses consecutive short recognition sessions (not continuous mode)
 * which is more stable across Chrome versions.
 *
 * Returns: { isActive, permissionDenied }
 */

import { useEffect, useRef, useState, useCallback } from "react";

const WAKE_PHRASES_EN = ["hello travlo", "hey travlo", "hi travlo", "travlo"];
const WAKE_PHRASES_AR = ["مرحبا ترافلو", "هلا ترافلو", "هاي ترافلو", "ترافلو"];

const STOP_PHRASES_EN = ["stop travlo", "stop", "shut up", "be quiet"];
const STOP_PHRASES_AR = ["توقف ترافلو", "توقف", "اسكت", "لحظة", "ترايفلو توقف"];

export type CommandType = "wake" | "stop";

function matchCommand(transcript: string): CommandType | null {
  const t = transcript.toLowerCase().trim();
  
  if (STOP_PHRASES_EN.some((p) => t.includes(p)) || STOP_PHRASES_AR.some((p) => t.includes(p))) {
    return "stop";
  }

  if (WAKE_PHRASES_EN.some((p) => t.includes(p)) || WAKE_PHRASES_AR.some((p) => t.includes(p))) {
    return "wake";
  }
  
  return null;
}

interface UseWakeWordOptions {
  language: "ar" | "en";
  enabled: boolean;
  suspended: boolean;
  onCommand: (type: CommandType, transcript: string) => void;
}

export function useWakeWord({
  language,
  enabled,
  suspended,
  onCommand,
}: UseWakeWordOptions) {
  const [isActive, setIsActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Refs so restart logic always sees current values
  const shouldRestartRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    // Use stop() instead of abort() for graceful release of mic hardware
    try { recognitionRef.current?.stop(); } catch(e) {}
    setIsActive(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI || !enabled || suspended) {
      stop();
      return;
    }

    shouldRestartRef.current = true;

    const createAndStart = () => {
      if (!shouldRestartRef.current) return;

      const recognition: SpeechRecognition = new SpeechRecognitionAPI();
      recognition.lang = language === "ar" ? "ar-OM" : "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Check all results + alternatives
        for (let i = 0; i < event.results.length; i++) {
          for (let j = 0; j < event.results[i].length; j++) {
            const transcript = event.results[i][j].transcript;
            const command = matchCommand(transcript);
            
            if (command) {
              shouldRestartRef.current = false;
              // Graceful stop so the OS unbinds the mic before we start the main VoiceButton
              try { recognition.stop(); } catch(e) {}
              setIsActive(false);
              onCommandRef.current(command, transcript.trim());
              return;
            }
          }
        }
      };

      recognition.onerror = (e: Event & { error?: string }) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setPermissionDenied(true);
          shouldRestartRef.current = false;
          setIsActive(false);
          return;
        }
        setPermissionDenied(false);
        // Other errors (no-speech, audio-capture, etc.) are fine — onend will restart
      };

      recognition.onend = () => {
        setIsActive(false);
        if (shouldRestartRef.current) {
          // A bit longer gap (500ms) to ensure mic fully releases before restart
          setTimeout(createAndStart, 500);
        }
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
        setIsActive(true);
      } catch {
        // If start fails, retry after delay
        setTimeout(createAndStart, 1000);
      }
    };

    createAndStart();

    return () => {
      stop();
    };
  }, [enabled, suspended, language, stop]);

  return { isActive, permissionDenied };
}
