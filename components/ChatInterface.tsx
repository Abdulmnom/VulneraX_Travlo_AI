"use client";

/**
 * ChatInterface – Main chat UI with embedded voice input + TTS controls
 *
 * VoiceButton is embedded directly in the input bar.
 * Each AI message has a speaker button (🔊) to read it aloud via TTS.
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Bot, User, Volume2, VolumeX } from "lucide-react";
import type { Recommendation } from "@/lib/ollama";
import RecommendationCard from "./RecommendationCard";
import VoiceButton from "./VoiceButton";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  recommendations?: Recommendation[];
  error?: string;
  provider?: "ollama" | "deepseek" | "claude";
}

interface ChatInterfaceProps {
  messages: Message[];
  inputValue: string;
  isLoading: boolean;
  language: "ar" | "en";
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onVoiceResult: (transcript: string) => void;
  onListeningChange: (isListening: boolean) => void;
  // TTS
  speakingMessageId: string | null;
  onSpeakMessage: (msgId: string, text: string) => void;
  onStopSpeaking: () => void;
  // Wake word programmatic trigger (legacy, kept for compatibility)
  voiceTriggerKey?: number;
  // New voice assistant props
  isVoiceRecording?: boolean;
  isVoiceProcessing?: boolean;
  audioLevel?: number;
  onToggleVoice?: () => void;
}

const PLACEHOLDERS = {
  en: "Ask about places, food, or attractions in Oman…",
  ar: "اسأل عن الأماكن والمطاعم والمناطق السياحية في عُمان…",
};

/** Build the spoken text for a set of recommendations */
function buildSpeakText(recommendations: Recommendation[]): string {
  return recommendations
    .map((r) => `${r.name}. ${r.description}`)
    .join(". ");
}

export default function ChatInterface({
  messages,
  inputValue,
  isLoading,
  language,
  onInputChange,
  onSubmit,
  onVoiceResult,
  onListeningChange,
  speakingMessageId,
  onSpeakMessage,
  onStopSpeaking,
  voiceTriggerKey,
  isVoiceRecording = false,
  isVoiceProcessing = false,
  audioLevel = 0,
  onToggleVoice,
}: ChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isAr = language === "ar";

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Message list ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4 pr-1 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isSpeakingThis = speakingMessageId === msg.id;
            const speakText =
              msg.recommendations ? buildSpeakText(msg.recommendations) : "";

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${
                  msg.role === "user"
                    ? isAr
                      ? "flex-row-reverse"
                      : "flex-row"
                    : "flex-row"
                }`}
                dir={isAr ? "rtl" : "ltr"}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === "user"
                      ? "bg-amber-500"
                      : "bg-white/10 border border-white/20"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User size={14} className="text-white" />
                  ) : (
                    <Bot size={14} className="text-amber-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* User message bubble */}
                  {msg.role === "user" && msg.text && (
                    <div
                      className={`inline-block rounded-2xl px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 text-white text-sm ${
                        isAr ? "float-right clear-both" : ""
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* AI error */}
                  {msg.role === "assistant" && msg.error && (
                    <div className="rounded-2xl px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                      ⚠️ {msg.error}
                    </div>
                  )}

                  {/* AI recommendations + TTS button */}
                  {msg.role === "assistant" &&
                    msg.recommendations &&
                    msg.recommendations.length > 0 && (
                      <div>
                        {/* Provider badge */}
                        {msg.provider && (
                          <span className="inline-flex items-center gap-1 text-xs text-white/35 mb-2">
                            {msg.provider === "ollama"   && "🖥️ Ollama"}
                            {msg.provider === "deepseek" && "🌐 DeepSeek"}
                            {msg.provider === "claude"   && "✦ Claude"}
                          </span>
                        )}
                        {/* TTS control row */}
                        <div className={`flex items-center gap-2 mb-2 ${isAr ? "flex-row-reverse" : ""}`}>
                          <motion.button
                            onClick={() =>
                              isSpeakingThis
                                ? onStopSpeaking()
                                : onSpeakMessage(msg.id, speakText)
                            }
                            whileTap={{ scale: 0.9 }}
                            title={
                              isSpeakingThis
                                ? language === "ar" ? "إيقاف" : "Stop speaking"
                                : language === "ar" ? "استمع للرد" : "Read aloud"
                            }
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-colors ${
                              isSpeakingThis
                                ? "bg-violet-500/20 border-violet-400/30 text-violet-300"
                                : "bg-white/5 border-white/15 text-white/50 hover:text-white/80 hover:bg-white/10"
                            }`}
                          >
                            {isSpeakingThis ? (
                              <>
                                <motion.span
                                  animate={{ opacity: [1, 0.3, 1] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                >
                                  <VolumeX size={12} />
                                </motion.span>
                                <span>{language === "ar" ? "إيقاف" : "Stop"}</span>
                              </>
                            ) : (
                              <>
                                <Volume2 size={12} />
                                <span>{language === "ar" ? "استمع" : "Listen"}</span>
                              </>
                            )}
                          </motion.button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                          {msg.recommendations.map((rec, i) => (
                            <RecommendationCard
                              key={`${msg.id}-${i}`}
                              rec={rec}
                              index={i}
                              language={language}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-amber-400" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl px-4 py-3 bg-white/5 border border-white/10">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full bg-amber-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────────────── */}
      <div className="mt-4" dir={isAr ? "rtl" : "ltr"}>
        <div className="flex items-end gap-2">
          {/* Mic button */}
          <div className="flex-shrink-0 pb-1">
            <VoiceButton
              language={language}
              isRecording={isVoiceRecording}
              isProcessing={isVoiceProcessing}
              audioLevel={audioLevel}
              onClick={onToggleVoice}
              disabled={isLoading}
            />
          </div>

          {/* Textarea */}
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              id="chat-input"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDERS[language]}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50 focus:bg-white/8 transition-all disabled:opacity-50 leading-relaxed"
              style={{ minHeight: "52px", maxHeight: "120px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
          </div>

          {/* Send button */}
          <div className="flex-shrink-0 pb-1">
            <button
              type="button"
              id="chat-send-btn"
              onClick={onSubmit}
              disabled={isLoading || !inputValue.trim()}
              aria-label={isAr ? "إرسال" : "Send"}
              className="w-11 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-lg"
            >
              {isLoading ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <Send size={18} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
