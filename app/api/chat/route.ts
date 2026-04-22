/**
 * POST /api/chat
 *
 * Main AI recommendation endpoint.
 * Flow: rate limit → sanitize → build conversation history → call Ollama → return JSON
 *
 * Now accepts `history` in the request body so the LLM has full context
 * of the current session and can answer follow-up questions correctly.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecommendations, checkOllamaHealth, type ConversationTurn } from "@/lib/ollama";
import { getRecommendationsFromClaude } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rateLimiter";
import { sanitizeInput } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  // ── 1. Extract client IP for rate limiting ───────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // ── 2. Rate limit check ──────────────────────────────────────────────────
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // ── 4. Parse request body ────────────────────────────────────────────────
  let body: { message?: string; history?: ConversationTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── 5. Sanitize and validate the current message ─────────────────────────
  const sanitized = sanitizeInput(body?.message ?? "");
  if (!sanitized.valid) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  // ── 5. Validate and cap conversation history ─────────────────────────────
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  // Each history entry must have a valid role + non-empty string content
  const history: ConversationTurn[] = rawHistory
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim().length > 0
    )
    .slice(-10) // cap to 10 turns (5 exchanges) to prevent context abuse
    .map((t) => ({
      role: t.role,
      content: t.content.trim().slice(0, 800), // cap each message length
    }));

  // ── 6. Call Ollama, fall back to Claude if unavailable ───────────────────
  try {
    const ollamaOk = await checkOllamaHealth();
    let result = ollamaOk
      ? await getRecommendations(sanitized.sanitized, history)
      : null;

    if (!ollamaOk || !result || result.recommendations.length === 0) {
      if (!ollamaOk) {
        console.warn("[/api/chat] Ollama unavailable — falling back to Claude");
      }
      result = await getRecommendationsFromClaude(sanitized.sanitized, history);
    }

    if (!result || result.recommendations.length === 0) {
      return NextResponse.json(
        { error: "Could not generate recommendations. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { recommendations: result.recommendations },
      {
        status: 200,
        headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
      }
    );
  } catch (err) {
    console.error("[/api/chat] Both Ollama and Claude failed:", err);
    return NextResponse.json(
      { error: "AI service is temporarily unavailable. Please try again  or there is a problem in OLLAMA_BASE_URL." },
      { status: 503 }
    );
  }
}

// Reject non-POST methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
