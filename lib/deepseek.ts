import { SYSTEM_PROMPT, type ConversationTurn, type OllamaResponse } from "@/lib/ollama";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

export async function getRecommendationsFromDeepSeek(
  userMessage: string,
  conversationHistory: ConversationTurn[] = []
): Promise<OllamaResponse> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10).map((t) => ({
      role: t.role as "user" | "assistant",
      content: t.content,
    })),
    { role: "user", content: userMessage },
  ];

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawText: string = data?.choices?.[0]?.message?.content ?? "";

  let parsed: OllamaResponse;
  try {
    const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error("[DeepSeek fallback] Failed to parse response:", rawText);
    return { recommendations: [], rawText };
  }

  if (!Array.isArray(parsed?.recommendations)) {
    return { recommendations: [] };
  }

  return parsed;
}
