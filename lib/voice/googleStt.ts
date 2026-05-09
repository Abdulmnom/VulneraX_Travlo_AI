/**
 * Google Cloud Speech-to-Text Client
 *
 * Fallback STT service used when local faster-whisper fails or times out.
 * Supports Arabic (ar-SA) and English (en-US) with automatic language detection.
 */

import { SpeechClient } from "@google-cloud/speech";
import { statSync } from "fs";

const client = new SpeechClient();

type GoogleEncoding = "WEBM_OPUS" | "MP3" | "LINEAR16" | "FLAC" | "OGG_OPUS";

function getEncodingConfig(audioPath: string): { encoding: GoogleEncoding; sampleRateHertz?: number } {
  const ext = audioPath.split(".").pop()?.toLowerCase() ?? "webm";
  switch (ext) {
    case "mp3":  return { encoding: "MP3" };
    case "wav":  return { encoding: "LINEAR16" };
    case "flac": return { encoding: "FLAC" };
    case "ogg":  return { encoding: "OGG_OPUS", sampleRateHertz: 48000 };
    default:     return { encoding: "WEBM_OPUS", sampleRateHertz: 48000 };
  }
}

export interface GoogleSttResult {
  transcript: string;
  language: "ar" | "en" | string;
  confidence: number;
}

/**
 * Transcribe an audio file using Google Cloud Speech-to-Text.
 * Expects a WebM/Opus file (as produced by MediaRecorder in Chrome).
 */
export async function transcribeWithGoogle(audioPath: string): Promise<GoogleSttResult> {
  // Check file size first
  try {
    const stats = statSync(audioPath);
    console.log("[Google STT] Audio file size:", stats.size, "bytes");
    if (stats.size < 1000) {
      throw new Error("Audio file too small (likely empty recording)");
    }
  } catch (e) {
    console.error("[Google STT] Cannot read audio file:", e);
    throw new Error("Cannot read audio file");
  }

  // Lazy import fs to avoid turbopack build tracing warnings
  const { readFileSync } = await import("fs");
  const audioBytes = readFileSync(audioPath).toString("base64");

  const audio = {
    content: audioBytes,
  };

  const { encoding, sampleRateHertz } = getEncodingConfig(audioPath);
  const config = {
    encoding,
    ...(sampleRateHertz !== undefined && { sampleRateHertz }),
    languageCode: "ar-SA",
    alternativeLanguageCodes: ["en-US"],
    model: "latest_long",
    useEnhanced: true,
  };

  const request = {
    audio,
    config,
  };

  console.log("[Google STT] Sending request...");

  let response;
  try {
    [response] = await client.recognize(request);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Google STT] API call failed:", errorMsg);
    throw new Error(`Google STT API error: ${errorMsg}`);
  }

  console.log("[Google STT] Response:", JSON.stringify(response, null, 2));

  // Check if response has results
  if (!response.results || response.results.length === 0) {
    console.warn("[Google STT] No results returned - possible causes:");
    console.warn("  - Audio file is empty or corrupted");
    console.warn("  - No speech detected in audio");
    console.warn("  - Authentication issue with Google Cloud");
    console.warn("  - API not enabled in Google Cloud Console");
    throw new Error("No speech detected in audio");
  }

  const result = response.results[0];
  const alternative = result.alternatives?.[0];
  const transcript = alternative?.transcript?.trim() ?? "";
  const confidence = alternative?.confidence ?? 0;

  if (!transcript) {
    console.warn("[Google STT] Empty transcript returned");
    throw new Error("No speech detected in audio");
  }

  // Detect language from the response or fall back to simple heuristic
  let language: "ar" | "en" | string = "en";
  if (result.languageCode?.startsWith("ar")) {
    language = "ar";
  } else if (result.languageCode?.startsWith("en")) {
    language = "en";
  } else if (/[\u0600-\u06FF]/.test(transcript)) {
    language = "ar";
  }

  console.log("[Google STT] Success - transcript:", transcript.substring(0, 50) + "...", "language:", language);

  return {
    transcript,
    language,
    confidence,
  };
}
