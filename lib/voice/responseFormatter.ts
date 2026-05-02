/**
 * Response Formatter
 *
 * Converts structured Recommendation[] into a short, natural-sounding
 * text suitable for text-to-speech (voice mode).
 * Written in a warm, lively, human tone.
 */

import type { Recommendation } from "@/lib/ollama";

// Varied openers so the AI doesn't sound repetitive
const EN_OPENERS = [
  "Great question! Here's what I'd recommend:",
  "Oh, I love this one! Here's what I've got for you:",
  "You're going to love these! Check them out:",
  "Absolutely! Here are my top picks for you:",
  "Perfect timing — here's what I'd suggest:",
];

const AR_OPENERS = [
  "سؤال رائع! إليك ما أوصي به:",
  "ممتاز! هذه أفضل اقتراحاتي لك:",
  "أنت ستحب هذه الأماكن! تفضل:",
  "بكل سرور! إليك أبرز ما أنصح به:",
  "تمام! هذه خياراتي المفضلة لك:",
];

function randomOpener(openers: string[]): string {
  return openers[Math.floor(Math.random() * openers.length)];
}

export function formatVoiceResponse(
  recommendations: Recommendation[],
  language: "ar" | "en"
): string {
  if (!recommendations || recommendations.length === 0) {
    return language === "ar"
      ? "آسف، لم أتمكن من إيجاد توصيات مناسبة الآن. هل يمكنك إعادة السؤال بطريقة مختلفة؟"
      : "Hmm, I couldn't find anything right now. Could you try asking in a different way?";
  }

  if (language === "ar") {
    const opener = randomOpener(AR_OPENERS);
    const parts: string[] = [opener];
    for (const rec of recommendations) {
      parts.push(`${rec.emoji} ${rec.name}: ${rec.description}`);
    }
    return parts.join(". ");
  }

  const opener = randomOpener(EN_OPENERS);
  const parts: string[] = [opener];
  for (const rec of recommendations) {
    parts.push(`${rec.emoji} ${rec.name}: ${rec.description}`);
  }
  return parts.join(". ");
}
