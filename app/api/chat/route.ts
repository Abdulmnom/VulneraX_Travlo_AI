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
import { getRecommendationsFromDeepSeek } from "@/lib/deepseek";
import { getRecommendationsFromClaude } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rateLimiter";
import { sanitizeInput } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  // ── 1. Extract client IP for rate limiting ───────────────────────────────
  // Prefer x-real-ip set by Nginx from the verified connection, not
  // attacker-controllable x-forwarded-for.
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
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
  const history: ConversationTurn[] = rawHistory
    .filter(
      (t) =>
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string" &&
        t.content.trim().length > 0
    )
    .slice(-10)
    .flatMap((t): ConversationTurn[] => {
      // Apply same injection guard to history entries as to the current message
      const result = sanitizeInput(t.content.trim().slice(0, 800));
      return result.valid ? [{ role: t.role, content: result.sanitized }] : [];
    });

  // ── 6. Call Ollama → DeepSeek → Claude (three-tier fallback) ────────────
  try {
    // Tier 1: Ollama (local LLM)
    const ollamaOk = await checkOllamaHealth();
    if (ollamaOk) {
      try {
        const result = await getRecommendations(sanitized.sanitized, history);
        if (result.recommendations.length > 0) {
          return NextResponse.json(
            { recommendations: result.recommendations },
            { status: 200, headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
          );
        }
      } catch (err) {
        console.warn("[/api/chat] Ollama failed:", err);
      }
    } else {
      console.warn("[/api/chat] Primary LLM unavailable — attempting fallback");
    }

    // Tier 2: DeepSeek API
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const result = await getRecommendationsFromDeepSeek(sanitized.sanitized, history);
        if (result.recommendations.length > 0) {
          return NextResponse.json(
            { recommendations: result.recommendations },
            { status: 200, headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
          );
        }
      } catch (err) {
        console.warn("[/api/chat] DeepSeek failed:", err);
      }
    } else {
      console.warn("[/api/chat] Secondary LLM unavailable — attempting final fallback");
    }

    // Tier 3: Claude API
    const result = await getRecommendationsFromClaude(sanitized.sanitized, history);
    if (!result || result.recommendations.length === 0) {
      return NextResponse.json(
        { error: "Could not generate recommendations. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { recommendations: result.recommendations },
      { status: 200, headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  } catch (err) {
    console.error("[/api/chat] All three providers failed:", err);
    return NextResponse.json(
      { error: "AI service is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}

// Reject non-POST methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
