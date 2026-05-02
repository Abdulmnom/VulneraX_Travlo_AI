/**
 * Google Cloud Text-to-Speech Client
 *
 * Fallback TTS service used when browser Web Speech API is unavailable
 * or does not support the requested language (e.g., Arabic on some platforms).
 */

import { TextToSpeechClient } from "@google-cloud/text-to-speech";

const client = new TextToSpeechClient();

export interface GoogleTtsResult {
  audioBase64: string;
  contentType: string;
}

/**
 * Synthesize speech from text using Google Cloud TTS.
 * Returns base64-encoded MP3 audio.
 */
export async function synthesizeSpeech(
  text: string,
  language: "ar" | "en"
): Promise<GoogleTtsResult> {
  const voiceName = language === "ar"
    ? "ar-XA-Wavenet-B"      // Arabic (Gulf) male voice
    : "en-US-Neural2-D";     // English US male voice

  const request = {
    input: { text },
    voice: {
      languageCode: language === "ar" ? "ar-XA" : "en-US",
      name: voiceName,
      ssmlGender: "MALE" as const,
    },
    audioConfig: {
      audioEncoding: "MP3" as const,
      pitch: 0,
      speakingRate: language === "ar" ? 0.9 : 1.0,
    },
  };

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error("Google TTS returned empty audio content");
  }

  const audioBase64 =
    typeof response.audioContent === "string"
      ? response.audioContent
      : Buffer.from(response.audioContent).toString("base64");

  return {
    audioBase64,
    contentType: "audio/mp3",
  };
}
