/**
 * Ollama AI Client
 *
 * Communicates with the local Ollama API to generate tourism recommendations.
 * All requests are internal — no data leaves the Docker network.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Recommendation {
  name: string;
  category: "food" | "culture" | "nature" | "adventure" | "shopping";
  description: string;
  emoji: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaResponse {
  recommendations: Recommendation[];
  rawText?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

/**
 * The system prompt defines the AI persona: a knowledgeable, concise, and
 * honest tour guide for Oman. It prevents hallucination by instructing the
 * model to only describe real, well-known places.
 */
export const SYSTEM_PROMPT = `You are Travlo, an expert local tourism guide for the Sultanate of Oman.
Your role is to recommend real places, food, and attractions to tourists visiting Oman.

Rules you MUST follow:
1. Only recommend real, well-known places that actually exist in Oman.
2. Never invent or hallucinate locations, restaurants, or attractions.
3. Respond in the SAME language the user writes in (Arabic → Arabic, English → English).
4. Always return a valid JSON object — no markdown code fences, no extra text.
5. Limit descriptions to 2 sentences maximum.
6. Return between 3 and 5 recommendations per request.

Response format (STRICT JSON only):
{
  "recommendations": [
    {
      "name": "Place name",
      "category": "food|culture|nature|adventure|shopping",
      "description": "Short description in 1-2 sentences.",
      "emoji": "🍽️"
    }
  ]
}`;

// ── Ollama client ─────────────────────────────────────────────────────────────

/**
 * Sends a user message to the local Ollama model and parses the structured
 * JSON recommendation response.
 */
export async function getRecommendations(
  userMessage: string
): Promise<OllamaResponse> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min — llama3 8B needs time

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        format: "json", // Ask Ollama to enforce JSON output
        options: {
          temperature: 0.3,
          top_p: 0.85,
          num_predict: 512, // Keep responses short for speed on local hardware
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rawText: string = data?.message?.content ?? "";

    // Parse the JSON response from the model
    let parsed: OllamaResponse;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // If JSON parse fails, return a user-friendly fallback
      console.error("[Ollama] Failed to parse model response:", rawText);
      return {
        recommendations: [],
        rawText,
      };
    }

    // Validate the recommendations array
    if (!Array.isArray(parsed?.recommendations)) {
      return { recommendations: [] };
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks if the Ollama service is reachable.
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
