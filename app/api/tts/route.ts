/**
 * POST /api/tts
 *
 * Fallback Text-to-Speech using Google Cloud TTS.
 * Used when the browser's Web Speech API is unavailable or lacks Arabic voices.
 */

import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice/googleTts";
import { checkRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  // ── 1. Extract client IP ─────────────────────────────────────────────────
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  // ── 2. Rate limit (separate, more generous bucket for TTS) ───────────────
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }

  // ── 3. Parse body ────────────────────────────────────────────────────────
  let body: { text?: string; language?: "ar" | "en" | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body?.text ?? "").trim();
  const language = body?.language ?? "en";

  console.log("[/api/tts] Request received:", { text: text.substring(0, 50), language });

  if (!text) {
    console.log("[/api/tts] Rejected: empty text");
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }
  if (text.length > 1500) {
    console.log("[/api/tts] Rejected: text too long", text.length);
    return NextResponse.json(
      { error: "text too long (max 1500 chars)." },
      { status: 400 }
    );
  }

  // Validate language
  if (language !== "ar" && language !== "en") {
    console.log("[/api/tts] Rejected: invalid language", language);
    return NextResponse.json(
      { error: "language must be 'ar' or 'en'." },
      { status: 400 }
    );
  }

  // ── 4. Synthesize speech ─────────────────────────────────────────────────
  try {
    console.log("[/api/tts] Calling Google TTS...");
    const result = await synthesizeSpeech(text, language as "ar" | "en");
    console.log("[/api/tts] Success, audio size:", result.audioBase64.length);
    return NextResponse.json(
      {
        audioBase64: result.audioBase64,
        contentType: result.contentType,
      },
      { status: 200 }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[/api/tts] Google TTS failed:", errorMsg);
    return NextResponse.json(
      { error: "Text-to-speech service is temporarily unavailable." },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
