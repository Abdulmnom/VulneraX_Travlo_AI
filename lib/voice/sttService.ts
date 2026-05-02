/**
 * STT Service
 *
 * Unified speech-to-text service:
 * 1. Attempts local transcription via faster-whisper (Python subprocess)
 * 2. Falls back to Google Cloud Speech-to-Text on:
 *    - timeout (> 8s default)
 *    - Python process failure
 *    - empty or very short transcript
 *    - low confidence (< 0.5)
 */

import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { transcribeWithGoogle } from "./googleStt";

export interface SttResult {
  transcript: string;
  language: "ar" | "en" | string;
  confidence: number;
  source: "local" | "fallback";
}

const WHISPER_MODEL = process.env.WHISPER_MODEL ?? "base";
const WHISPER_COMPUTE_TYPE = process.env.WHISPER_COMPUTE_TYPE ?? "int8";
const WHISPER_TIMEOUT_MS = parseInt(process.env.WHISPER_TIMEOUT_MS ?? "8000", 10);
const WHISPER_MIN_CONFIDENCE = parseFloat(process.env.WHISPER_MIN_CONFIDENCE ?? "0.5");

/**
 * Detect the correct Python path based on environment:
 * - Docker: /opt/whisper-env/bin/python
 * - Windows local: python or python3 from PATH
 */
function getWhisperConfig() {
  // Allow explicit override via env
  if (process.env.WHISPER_PYTHON_PATH) {
    return {
      pythonPath: process.env.WHISPER_PYTHON_PATH,
      scriptPath: "./lib/voice/whisper_transcribe.py",
    };
  }

  // Auto-detect based on platform
  const isWindows = process.platform === "win32";
  const isDocker = process.env.DOCKER_ENV === "true" || process.env.HOSTNAME === "travlo_nextjs";

  if (isDocker) {
    return {
      pythonPath: "/opt/whisper-env/bin/python",
      scriptPath: "./lib/voice/whisper_transcribe.py",
    };
  }

  // Local development (Windows/Mac/Linux)
  return {
    pythonPath: isWindows ? "python" : "python3",
    scriptPath: "./lib/voice/whisper_transcribe.py",
  };
}

/**
 * Check if local Whisper is available (Python + faster-whisper installed)
 */
async function isWhisperAvailable(): Promise<boolean> {
  const { pythonPath } = getWhisperConfig();
  return new Promise((resolve) => {
    const proc = spawn(pythonPath, ["-c", "import faster_whisper"], {
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 5000,
    });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Write a Blob buffer to a temp file and return the path.
 */
async function writeTempAudioFile(buffer: Buffer): Promise<string> {
  const { tmpdir } = await import("os");
  const { writeFile } = await import("fs/promises");
  const tempPath = `${tmpdir()}/travlo-stt-${randomUUID()}.webm`;
  await writeFile(tempPath, buffer);
  return tempPath;
}

/**
 * Run faster-whisper via Python subprocess with a configurable timeout.
 */
async function runWhisper(audioPath: string): Promise<SttResult | null> {
  const { pythonPath, scriptPath } = getWhisperConfig();
  return new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      "--audio", audioPath,
      "--model", WHISPER_MODEL,
      "--compute_type", WHISPER_COMPUTE_TYPE,
    ];

    const proc = spawn(pythonPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: WHISPER_TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Whisper spawn error: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Whisper exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        const transcript = (result.transcript ?? "").trim();
        const language: string = result.language ?? "en";
        const confidence: number = result.probability ?? 0;

        if (!transcript || transcript.length < 2) {
          reject(new Error("Whisper returned empty transcript"));
          return;
        }

        resolve({
          transcript,
          language,
          confidence,
          source: "local",
        });
      } catch (parseErr) {
        reject(new Error(`Failed to parse Whisper output: ${stdout}`));
      }
    });
  });
}

/**
 * Transcribe audio buffer.
 * Tries local Whisper first (if available), then falls back to Google Cloud STT.
 */
export async function transcribeAudio(buffer: Buffer): Promise<SttResult> {
  const tempPath = await writeTempAudioFile(buffer);

  // Check if local Whisper is available before trying
  const whisperAvailable = await isWhisperAvailable();
  if (!whisperAvailable) {
    console.warn("[STT] Local Whisper not available (Python/faster-whisper missing), using Google Cloud STT");
    const googleResult = await transcribeWithGoogle(tempPath);
    // Clean up temp file
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPath);
    } catch { /* ignore */ }

    return {
      transcript: googleResult.transcript,
      language: googleResult.language,
      confidence: googleResult.confidence,
      source: "fallback",
    };
  }

  try {
    // Attempt local transcription
    const localResult = await Promise.race([
      runWhisper(tempPath),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Whisper timeout")), WHISPER_TIMEOUT_MS)
      ),
    ]);

    // If confidence is too low, treat as failure and fallback
    if (localResult && localResult.confidence < WHISPER_MIN_CONFIDENCE) {
      throw new Error(`Whisper confidence too low (${localResult.confidence})`);
    }

    // Clean up temp file
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPath);
    } catch { /* ignore */ }

    return localResult!;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[STT] Local whisper failed (${errorMsg}), falling back to Google Cloud STT`);

    // Fallback to Google Cloud STT
    const googleResult = await transcribeWithGoogle(tempPath);

    // Clean up temp file
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(tempPath);
    } catch { /* ignore */ }

    return {
      transcript: googleResult.transcript,
      language: googleResult.language,
      confidence: googleResult.confidence,
      source: "fallback",
    };
  }
}
