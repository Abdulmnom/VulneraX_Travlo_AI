/**
 * POST /api/voice-enhance
 *
 * Cleans raw speech-to-text before it is displayed or sent to the chat LLM.
 * Flow: rate-limit → sanitize length → enhanceVoiceTranscript → return cleaned text
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimiter";
import { enhanceVoiceTranscript } from "@/lib/voiceEnhancer";

export async function POST(req: NextRequest) {
  // ── 1. Rate limit (shared IP bucket with /api/chat) ──────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)) } }
    );
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = (body?.transcript ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "transcript is required." }, { status: 400 });
  }
  if (raw.length > 300) {
    return NextResponse.json({ error: "Transcript too long (max 300 chars)." }, { status: 400 });
  }

  // ── 3. Enhance via Ollama ─────────────────────────────────────────────────
  const result = await enhanceVoiceTranscript(raw);

  return NextResponse.json(
    {
      enhanced: result.enhanced,
      original: result.original,
      wasEnhanced: result.wasEnhanced,
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
