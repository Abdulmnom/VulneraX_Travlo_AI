/**
 * Voice Transcript Enhancer
 *
 * Takes raw speech-to-text output (which can be noisy, fragmented, or
 * grammatically incorrect) and uses a local Ollama model to clean it up
 * into a proper, intent-preserving user question.
 *
 * This runs BEFORE the main chat pipeline so the LLM always receives
 * well-formed input without polluting the conversation history.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:30b-a3b";

// Maximum characters we allow from the voice transcript
const MAX_TRANSCRIPT_LENGTH = 300;

/**
 * System prompt for the voice enhancer.
 * It is structured to understand Omani context and fix Arabic speech-to-text flaws.
 */
const VOICE_ENHANCER_SYSTEM_PROMPT = `You are a voice-to-text post-processor for a tourism assistant in Oman.
Your ONLY job is to take noisy speech-to-text output and return a clean, well-formed question or statement.

Rules:
1. Preserve the original INTENT and LANGUAGE of the user (Arabic stays Arabic, English stays English).
2. Fix grammar, punctuation, repeated words, and filler words (um, uh, آه, يعني, بصراحة).
3. Do NOT add extra information or change the meaning.
4. Correct common misspellings of Omani locations (e.g. if the user says "نزوا", change it to "نزوى". If they say "مسكت", change it to "مسقط", "صلاله" to "صلالة").
5. Do NOT answer the question — just clean the input text.
6. Return ONLY the cleaned text as a plain string — no JSON, no quotes, no explanation.
7. If the input is completely unintelligible, return the empty string "".`;

export interface VoiceEnhanceResult {
  enhanced: string;     // The cleaned transcript
  original: string;     // The raw transcript (for fallback)
  wasEnhanced: boolean; // Whether enhancement actually changed anything
}

/**
 * Sends the raw transcript to the local Ollama model for cleaning.
 * Falls back to the original transcript if Ollama is unavailable or slow.
 */
export async function enhanceVoiceTranscript(
  rawTranscript: string
): Promise<VoiceEnhanceResult> {
  const original = rawTranscript.trim().slice(0, MAX_TRANSCRIPT_LENGTH);

  if (!original) {
    return { enhanced: "", original: "", wasEnhanced: false };
  }

  const controller = new AbortController();
  // 10-second timeout — must be fast for good UX
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: VOICE_ENHANCER_SYSTEM_PROMPT },
          { role: "user", content: original },
        ],
        stream: false,
        options: {
          temperature: 0.3,   // Higher temperature allows the model to rephrase disjointed Arabic words into proper grammar
          top_p: 0.9,
          num_predict: 150,   // Short output — just the cleaned text
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn("[VoiceEnhancer] Ollama returned non-OK:", response.status);
      return { enhanced: original, original, wasEnhanced: false };
    }

    const data = await response.json();
    const enhanced = (data?.message?.content ?? "").trim();

    // Safety: if the enhancer returned nothing or gibberish, fall back
    if (!enhanced || enhanced.length < 1) {
      return { enhanced: original, original, wasEnhanced: false };
    }

    return {
      enhanced,
      original,
      wasEnhanced: enhanced !== original,
    };
  } catch (err) {
    clearTimeout(timeout);
    // Any error (timeout, network) → silently fall back to original
    if ((err as Error).name === "AbortError") {
      console.warn("[VoiceEnhancer] Timed out — using raw transcript");
    } else {
      console.error("[VoiceEnhancer] Error:", err);
    }
    return { enhanced: original, original, wasEnhanced: false };
  }
}
