/**
 * POST /api/chat
 *
 * Main AI recommendation endpoint.
 * Flow: rate limit → sanitize → call Ollama → return structured JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@/lib/ollama";
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

  // ── 3. Parse request body ────────────────────────────────────────────────
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── 4. Sanitize and validate input ───────────────────────────────────────
  const sanitized = sanitizeInput(body?.message ?? "");
  if (!sanitized.valid) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  // ── 5. Call Ollama LLM ───────────────────────────────────────────────────
  try {
    const result = await getRecommendations(sanitized.sanitized);

    if (result.recommendations.length === 0) {
      return NextResponse.json(
        { error: "Could not generate recommendations. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { recommendations: result.recommendations },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  } catch (err) {
    console.error("[/api/chat] Ollama request failed:", err);
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
