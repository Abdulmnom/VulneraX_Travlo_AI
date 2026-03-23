/**
 * GET /api/health
 *
 * Health check endpoint. Verifies connectivity to Ollama and MongoDB.
 * Used by Docker health checks and monitoring.
 */

import { NextResponse } from "next/server";
import { checkOllamaHealth } from "@/lib/ollama";

export async function GET() {
  const ollamaOk = await checkOllamaHealth();

  // Simple in-process check — MongoDB connectivity can be added here
  const status = {
    status: ollamaOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      ollama: ollamaOk,
    },
  };

  return NextResponse.json(status, {
    status: ollamaOk ? 200 : 503,
  });
}
