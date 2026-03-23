"use client";

/**
 * ChatInterface – Main chat UI
 *
 * Displays the conversation history (user messages + AI recommendations).
 * Handles the text input, loading states, and error feedback.
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Bot, User } from "lucide-react";
import type { Recommendation } from "@/lib/ollama";
import RecommendationCard from "./RecommendationCard";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  recommendations?: Recommendation[];
  error?: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  inputValue: string;
  isLoading: boolean;
  language: "ar" | "en";
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

const PLACEHOLDERS = {
  en: "Ask about places, food, or attractions in Oman...",
  ar: "اسأل عن الأماكن والمطاعم والمناطق السياحية في عُمان...",
};

export default function ChatInterface({
  messages,
  inputValue,
  isLoading,
  language,
  onInputChange,
  onSubmit,
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
      {/* ── Message list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4 pr-1 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
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

                {/* AI recommendations grid */}
                {msg.role === "assistant" &&
                  msg.recommendations &&
                  msg.recommendations.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 mt-1">
                      {msg.recommendations.map((rec, i) => (
                        <RecommendationCard
                          key={`${msg.id}-${i}`}
                          rec={rec}
                          index={i}
                          language={language}
                        />
                      ))}
                    </div>
                  )}
              </div>
            </motion.div>
          ))}
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
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────────── */}
      <div className="mt-4 relative" dir={isAr ? "rtl" : "ltr"}>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[language]}
          rows={1}
          disabled={isLoading}
          className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 pr-14 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50 focus:bg-white/8 transition-all disabled:opacity-50 leading-relaxed"
          style={{ minHeight: "52px", maxHeight: "120px" }}
          onInput={(e) => {
            // Auto-resize textarea
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />

        {/* Send button */}
        <button
          onClick={onSubmit}
          disabled={isLoading || !inputValue.trim()}
          className={`absolute top-1/2 -translate-y-1/2 ${
            isAr ? "left-3" : "right-3"
          } w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors`}
        >
          {isLoading ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <Send size={16} className="text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
