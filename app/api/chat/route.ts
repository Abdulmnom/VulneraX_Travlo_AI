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
import { generateChatResponse } from "@/lib/chatService";
import { type ConversationTurn } from "@/lib/ollama";
import { checkRateLimit } from "@/lib/rateLimiter";
import { sanitizeInput } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  // ── 1. Extract client IP for rate limiting ───────────────────────────────
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

  // ── 3. Parse request body ────────────────────────────────────────────────
  let body: { message?: string; history?: ConversationTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── 4. Sanitize and validate the current message ─────────────────────────
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

  // ── 6. Call LLM via chatService (three-tier fallback) ─────────────────────
  try {
    const result = await generateChatResponse(sanitized.sanitized, { history });
    return NextResponse.json(
      {
        recommendations: result.recommendations,
        provider: result.provider,
      },
      { status: 200, headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  } catch (err) {
    console.error("[/api/chat] All LLM providers failed:", err);
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
