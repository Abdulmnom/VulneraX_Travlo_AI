/**
 * POST /api/voice-assistant
 *
 * Full voice pipeline:
 *   1. Receive multipart form data:
 *        - "transcript" (text) â€” browser SpeechRecognition result  [preferred]
 *        - "audio" (File)      â€” raw audio blob for server-side STT [fallback]
 *        - "history" (JSON)    â€” optional conversation turns
 *   2. Rate-limit + sanitize
 *   3a. If "transcript" field present â†’ skip STT entirely
 *   3b. Otherwise â†’ STT (local Whisper â†’ Google Cloud fallback)
 *   4. LLM (Ollama â†’ DeepSeek â†’ Claude) with voice-mode prompt
 *   5. Format recommendations into natural voice text
 *   6. Return JSON with transcript, response, language, source, latency
 */

import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/voice/sttService";
import { formatVoiceResponse } from "@/lib/voice/responseFormatter";
import { generateChatResponse } from "@/lib/chatService";
import { checkRateLimit } from "@/lib/rateLimiter";
import { sanitizeInput } from "@/lib/sanitize";
import type { ConversationTurn } from "@/lib/ollama";

const MAX_AUDIO_SIZE_MB = 5;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // â”€â”€ 1. Extract client IP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  // â”€â”€ 2. Rate limit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)) },
      }
    );
  }

  // â”€â”€ 3. Parse multipart form data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let audioBuffer: Buffer | null = null;
  let browserTranscript: string | null = null;
  let history: ConversationTurn[] = [];

  try {
    const formData = await req.formData();

    // Check for pre-computed browser transcript first
    const transcriptField = formData.get("transcript");
    if (transcriptField && typeof transcriptField === "string" && transcriptField.trim().length >= 2) {
      browserTranscript = transcriptField.trim();
    }

    // Only require audio blob if no transcript was provided
    if (!browserTranscript) {
      const audioFile = formData.get("audio");

      if (!audioFile || !(audioFile instanceof File)) {
        return NextResponse.json(
          { error: "Either a transcript or an audio file is required." },
          { status: 400 }
        );
      }

      if (audioFile.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
        return NextResponse.json(
          { error: `Audio file too large (max ${MAX_AUDIO_SIZE_MB}MB).` },
          { status: 413 }
        );
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    }

    // Parse optional history JSON
    const historyRaw = formData.get("history");
    if (historyRaw && typeof historyRaw === "string") {
      try {
        const parsed = JSON.parse(historyRaw);
        if (Array.isArray(parsed)) {
          history = parsed
            .filter(
              (t: unknown) =>
                t &&
                typeof t === "object" &&
                (t as Record<string, unknown>).role &&
                (t as Record<string, unknown>).content
            )
            .slice(-10)
            .map((t: Record<string, string>) => ({
              role: t.role as "user" | "assistant",
              content: t.content.slice(0, 800),
            }));
        }
      } catch {
        // Ignore invalid history JSON
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  // â”€â”€ 4. Speech-to-Text (or use browser transcript) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let sttResult: Awaited<ReturnType<typeof transcribeAudio>>;

  if (browserTranscript) {
    // âœ… Browser SpeechRecognition transcript â€” skip server STT entirely
    console.log("[/api/voice-assistant] Using browser transcript:", browserTranscript.substring(0, 60));
    sttResult = {
      transcript: browserTranscript,
      language: "en", // overridden below by Arabic Unicode detection
      confidence: 1,
      source: "local",
    };
  } else {
    // âš™ï¸ Server-side STT: Whisper â†’ Google Cloud fallback
    try {
      sttResult = await transcribeAudio(audioBuffer!);
    } catch (err) {
      console.error("[/api/voice-assistant] STT failed:", err);
      return NextResponse.json(
        { error: "Could not understand the audio. Please try again." },
        { status: 502 }
      );
    }
  }

  const transcript = sttResult.transcript;
  if (!transcript || transcript.length < 2) {
    return NextResponse.json(
      { error: "No speech detected. Please try again." },
      { status: 400 }
    );
  }

  // â”€â”€ 5. Sanitize transcript â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sanitized = sanitizeInput(transcript);
  if (!sanitized.valid) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  // â”€â”€ 6. Detect language â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const detectedLang: "ar" | "en" =
    sttResult.language === "ar" || /[؀-ۿ]/.test(transcript) ? "ar" : "en";

  // â”€â”€ 7. LLM (voice mode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let chatResult: Awaited<ReturnType<typeof generateChatResponse>>;
  try {
    chatResult = await generateChatResponse(sanitized.sanitized, {
      history,
      voiceMode: true,
    });
  } catch (err) {
    console.error("[/api/voice-assistant] LLM failed:", err);
    return NextResponse.json(
      { error: "AI assistant is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }

  // â”€â”€ 8. Format voice response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const voiceText = formatVoiceResponse(chatResult.recommendations, detectedLang);

  const latencyMs = Date.now() - startTime;

  return NextResponse.json(
    {
      transcript,
      response: voiceText,
      language: detectedLang,
      source: sttResult.source,
      latency_ms: latencyMs,
      recommendations: chatResult.recommendations,
      provider: chatResult.provider,
    },
    { status: 200, headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

