"use client";

/**
 * useVoiceRecorder – Browser audio recording via MediaRecorder (WebM/Opus)
 *
 * Returns:
 *   - isRecording
 *   - audioLevel (0–1) for visualizing a waveform
 *   - start() / stop()
 *   - blob (recorded audio once stopped)
 */

import { useCallback, useEffect, useRef, useState } from "react";

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);

  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mimeTypeRef = useRef<string>("");

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRef.current) {
      mediaRef.current.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    cleanup();
    chunksRef.current = [];
    setBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;

      // AudioContext + Analyser for waveform visualization
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        // Average volume normalized to 0–1
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(1, avg / 128));
        rafRef.current = requestAnimationFrame(updateLevel);
      };
      rafRef.current = requestAnimationFrame(updateLevel);

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;
      console.log("[useVoiceRecorder] Using MIME type:", mimeType || "default");

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        console.log("[useVoiceRecorder] Data chunk received:", e.data.size, "bytes");
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        console.log("[useVoiceRecorder] Recording stopped, chunks:", chunksRef.current.length);
        if (chunksRef.current.length === 0) {
          console.error("[useVoiceRecorder] No audio chunks collected!");
          setBlob(null);
        } else {
          const recordedBlob = new Blob(chunksRef.current, {
            type: mimeTypeRef.current || "audio/webm",
          });
          console.log("[useVoiceRecorder] Created blob:", recordedBlob.size, "bytes, type:", recordedBlob.type);
          setBlob(recordedBlob);
        }
        cleanup();
      };

      recorder.onerror = (e) => {
        console.error("[useVoiceRecorder] Recorder error:", e);
        cleanup();
        setIsRecording(false);
      };

      // Request data more frequently to ensure we capture everything
      recorder.start(50); // collect chunks every 50ms
      setIsRecording(true);
      console.log("[useVoiceRecorder] Recording started");
    } catch (err) {
      console.error("[useVoiceRecorder] Failed to start recording:", err);
      cleanup();
      setIsRecording(false);
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    console.log("[useVoiceRecorder] Stopping recording...");
    try {
      // Request final data before stopping
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.requestData();
      }
      // Small delay to ensure final chunk is collected
      setTimeout(() => {
        recorderRef.current?.stop();
      }, 100);
    } catch (e) {
      console.error("[useVoiceRecorder] Error stopping recorder:", e);
    }
    setIsRecording(false);
  }, []);

  return { isRecording, audioLevel, start, stop, blob };
}
