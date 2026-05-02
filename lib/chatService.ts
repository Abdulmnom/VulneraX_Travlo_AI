/**
 * Chat Service
 *
 * Refactored LLM client that encapsulates the three-tier fallback chain:
 *   Ollama (local) → DeepSeek → Claude
 *
 * Can be used by both /api/chat and /api/voice-assistant.
 */

import {
  getRecommendations,
  checkOllamaHealth,
  SYSTEM_PROMPT,
  VOICE_SYSTEM_PROMPT,
  type ConversationTurn,
  type OllamaResponse,
} from "@/lib/ollama";
import { getRecommendationsFromDeepSeek } from "@/lib/deepseek";
import { getRecommendationsFromClaude } from "@/lib/claude";
import {
  buildRagSystemPrompt,
  getTourismContextForPrompt,
  hydrateRecommendationsWithRag,
} from "@/lib/rag/format";

export interface ChatServiceResult {
  recommendations: OllamaResponse["recommendations"];
  provider: "ollama" | "deepseek" | "claude";
  rawText?: string;
}

export interface ChatServiceOptions {
  history?: ConversationTurn[];
  voiceMode?: boolean;
}

/**
 * Generate chat response using the three-tier fallback chain.
 */
export async function generateChatResponse(
  message: string,
  options: ChatServiceOptions = {}
): Promise<ChatServiceResult> {
  const { history = [], voiceMode = false } = options;
  const language = getTourismContextForPrompt(message).language;
  const basePrompt = voiceMode ? VOICE_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const systemPrompt = buildRagSystemPrompt(basePrompt, message);

  // Tier 1: Ollama (local LLM)
  const ollamaOk = await checkOllamaHealth();
  if (ollamaOk) {
    try {
      const result = await getRecommendations(message, history, systemPrompt);
      if (result.recommendations.length > 0) {
        return {
          recommendations: hydrateRecommendationsWithRag(result.recommendations, language),
          provider: "ollama",
          rawText: result.rawText,
        };
      }
    } catch (err) {
      console.warn("[chatService] Ollama failed:", err);
    }
  } else {
    console.warn("[chatService] Ollama unavailable — attempting fallback");
  }

  // Tier 2: DeepSeek API
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const result = await getRecommendationsFromDeepSeek(message, history, systemPrompt);
      if (result.recommendations.length > 0) {
        return {
          recommendations: hydrateRecommendationsWithRag(result.recommendations, language),
          provider: "deepseek",
          rawText: result.rawText,
        };
      }
    } catch (err) {
      console.warn("[chatService] DeepSeek failed:", err);
    }
  } else {
    console.warn("[chatService] DeepSeek unavailable — attempting final fallback");
  }

  // Tier 3: Claude API
  const result = await getRecommendationsFromClaude(message, history, systemPrompt);
  if (!result || result.recommendations.length === 0) {
    throw new Error("All three LLM providers failed to generate recommendations");
  }

  return {
    recommendations: hydrateRecommendationsWithRag(result.recommendations, language),
    provider: "claude",
    rawText: result.rawText,
  };
}
