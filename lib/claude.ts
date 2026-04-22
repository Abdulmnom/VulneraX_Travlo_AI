/**
 * Claude AI Fallback Client
 *
 * Used automatically when Ollama is unavailable.
 * Returns the same OllamaResponse shape so the route handler needs no changes.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, type ConversationTurn, type OllamaResponse } from "@/lib/ollama";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getRecommendationsFromClaude(
  userMessage: string,
  conversationHistory: ConversationTurn[] = []
): Promise<OllamaResponse> {
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.slice(-10).map((t) => ({
      role: t.role as "user" | "assistant",
      content: t.content,
    })),
    { role: "user", content: userMessage },
  ];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: OllamaResponse;
  try {
    // Strip markdown fences if the model wraps JSON in them
    const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error("[Claude fallback] Failed to parse response:", rawText);
    return { recommendations: [], rawText };
  }

  if (!Array.isArray(parsed?.recommendations)) {
    return { recommendations: [] };
  }

  return parsed;
}
