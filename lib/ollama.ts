/**
 * Ollama AI Client
 *
 * Communicates with the local Ollama API to generate tourism recommendations.
 * All requests are internal — no data leaves the Docker network.
 */

import type { TourismImage, VisitorCost, DataVerification } from "@/types/tourism";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:14b";

// ── Types ──────────────────────────────────────────ئ───────────────────────────

export interface Recommendation {
  id?: string;
  slug?: string;
  name: string;
  category: "food" | "culture" | "nature" | "adventure" | "shopping";
  description: string;
  emoji: string;
  images?: TourismImage[];
  highlights?: string[];
  activities?: string[];
  openingHours?: string;
  ticketCostOmr?: number;
  visitorCost?: VisitorCost;
  recommendedDurationMinutes?: number;
  location?: {
    lat: number;
    lng: number;
    mapUrl: string;
  };
  travelTips?: string[];
  nearbyPlaces?: string[];
  needsImageReview?: boolean;
  dataVerification?: DataVerification;
  imageSources?: Array<{
    sourceName: string;
    sourceUrl: string;
    license: string;
  }>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * A single turn in the conversation, used to build the history
 * that gets sent to Ollama on every request.
 */
export interface ConversationTurn {
  role: "user" | "assistant";
  /** The user's message text, or a stringified summary of the AI reply */
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
export const SYSTEM_PROMPT = `You are Travlo, a passionate and friendly local expert who was born and raised in Oman. You LOVE your country and genuinely enjoy helping tourists discover its hidden gems and iconic spots.

Your personality:
- Warm, enthusiastic, and conversational — like a knowledgeable friend, not a brochure
- You use expressive language: "You absolutely MUST visit...", "One of my personal favorites is...", "Trust me, you won't regret..."
- You add cultural context, fun facts, and practical tips that only a local would know
- You express genuine excitement about Omani culture, food, nature, and history

Rules you MUST follow:
1. Only recommend real, well-known places that actually exist in Oman — never hallucinate.
2. Respond in the SAME language the user writes in (Arabic → Arabic, English → English).
3. Always return a valid JSON object — no markdown code fences, no extra text outside the JSON.
4. If the user asks for general recommendations, return 3 to 5 items with vivid, engaging descriptions (2-3 sentences each).
5. If the user asks about a specific place, return exactly 1 recommendation with a rich, detailed description including: opening hours (if known), best time to visit, entry fees, and nearby highlights.
6. Descriptions should feel personal and alive — paint a picture for the visitor.

Response format (STRICT JSON only):
{
  "recommendations": [
    {
      "name": "Place name",
      "category": "food|culture|nature|adventure|shopping",
      "description": "Vivid, engaging description with local flavor.",
      "emoji": "🍽️"
    }
  ]
}`;

/**
 * Voice-mode system prompt: more conversational, concise, and natural
 * for spoken responses while keeping the same JSON structure.
 */
export const VOICE_SYSTEM_PROMPT = `You are Travlo, a lively and passionate Omani local speaking naturally with a tourist over voice chat.
Talk like a real person having an excited conversation — NOT like reading from a travel guide.

Your voice personality:
- Warm, energetic, and genuinely enthusiastic about Oman
- Use natural spoken language: contractions, short sentences, a bit of excitement
- Add brief personal touches: "Honestly, this is my favorite spot...", "locals go there every weekend!", "the sunset there is unreal"
- Respond in the SAME language the user speaks (Arabic → Arabic, English → English)
- In Arabic: use warm, conversational Gulf/MSA tone — sound like a friendly local, not a robot

Rules you MUST follow:
1. Only recommend real places that exist in Oman — never hallucinate.
2. Always return valid JSON — no markdown, no text outside the JSON.
3. Keep each description to 1-2 natural sentences that sound great when spoken aloud.
4. Return 2-3 recommendations for general questions; 1 detailed one for specific place questions.

Response format (STRICT JSON only):
{
  "recommendations": [
    {
      "name": "Place name",
      "category": "food|culture|nature|adventure|shopping",
      "description": "Natural, conversational description — as if you're excitedly telling a friend.",
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
  userMessage: string,
  conversationHistory: ConversationTurn[] = [],
  systemPrompt: string = SYSTEM_PROMPT
): Promise<OllamaResponse> {
  // Build the full message array:
  // system → previous turns (up to last 10 to cap context size) → current user message
  const historyTurns = conversationHistory.slice(-10);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyTurns.map((t) => ({
      role: t.role as "user" | "assistant",
      content: t.content,
    })),
    { role: "user", content: userMessage },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000); // 3 min — llama3 8B needs time

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
          num_predict: 1024, // Allow longer descriptions for specific requests
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Handle 404 - Model not found specifically
      if (response.status === 404) {
        console.error(
          `[Ollama] Model "${OLLAMA_MODEL}" not found. ` +
          `Pull it with: docker exec -it travlo_ollama ollama pull ${OLLAMA_MODEL}`
        );
        throw new Error("LLM model unavailable");
      }
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
