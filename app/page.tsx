"use client";

/**
 * Travlo – Main Page
 *
 * Wires together: LanguageToggle, VoiceButton, ChatInterface, QRModal.
 * Manages top-level state: messages, language, loading, session ID.
 */

import { useState, useCallback, useId } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import ChatInterface, { type Message } from "@/components/ChatInterface";
import VoiceButton from "@/components/VoiceButton";
import LanguageToggle from "@/components/LanguageToggle";
import QRModal from "@/components/QRModal";
import type { Recommendation } from "@/lib/ollama";

// Generate a simple session ID for QR sharing
function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

const WELCOME_MESSAGES: Record<"en" | "ar", string> = {
  en: 'Welcome! I\'m Travlo — your AI tourism guide for Oman. Try asking: "Best restaurants in Muscat" or "Things to do in Nizwa".',
  ar: 'أهلاً! أنا ترافلو — دليلك السياحي الذكي في عُمان. جرب أن تسأل: "أفضل المطاعم في مسقط" أو "أماكن الترفيه في نزوى".',
};

export default function Home() {
  const [language, setLanguage] = useState<"ar" | "en">("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState<string>(generateSessionId);
  const msgIdBase = useId();
  const [msgCounter, setMsgCounter] = useState(0);

  const nextId = () => {
    setMsgCounter((n) => n + 1);
    return `${msgIdBase}-${Date.now()}`;
  };

  const welcomeText = WELCOME_MESSAGES[language];

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsgId = `${msgIdBase}-u-${Date.now()}`;
    const aiMsgId = `${msgIdBase}-a-${Date.now()}`;

    // Append user message immediately
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text },
    ]);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: aiMsgId, role: "assistant", error: data.error || "An error occurred." },
        ]);
        return;
      }

      const recommendations: Recommendation[] = data.recommendations ?? [];

      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: "assistant", recommendations },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "assistant",
          error:
            language === "ar"
              ? "تعذّر الاتصال بالمساعد. يرجى المحاولة مجدداً."
              : "Could not reach the AI assistant. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, language, msgIdBase]);

  const handleVoiceResult = useCallback((transcript: string) => {
    setInputValue(transcript);
  }, []);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-[#0b0f1a]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-white/10 bg-white/3 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 max-w-4xl mx-auto w-full">
          {/* Logo mark */}
          <div className="flex items-center gap-2.5">
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30"
            >
              <MapPin size={18} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">
                Travlo
              </h1>
              <p className="text-white/40 text-xs leading-none mt-0.5">
                {language === "ar" ? "دليل عُمان السياحي" : "Oman Tourism Guide"}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <QRModal sessionId={sessionId} language={language} />
            <LanguageToggle language={language} onChange={setLanguage} />
          </div>
        </div>
      </header>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 py-4">
        {/* Welcome banner — shown when no messages */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/6 px-5 py-4 text-sm text-amber-200/80 leading-relaxed"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {welcomeText}
          </motion.div>
        )}

        {/* Suggestion chips — shown when no messages */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-2 mb-6"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {(language === "en"
              ? [
                  "🍽️ Best restaurants in Muscat",
                  "🏔️ Things to do in Nizwa",
                  "🏖️ Beaches near Muscat",
                  "🕌 Historic forts in Oman",
                ]
              : [
                  "🍽️ أفضل مطاعم مسقط",
                  "🏔️ أماكن سياحية في نزوى",
                  "🏖️ شواطئ قرب مسقط",
                  "🕌 الحصون التاريخية في عُمان",
                ]
            ).map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setInputValue(chip.replace(/^[\p{Emoji}\s]+/u, "").trim());
                }}
                className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
              >
                {chip}
              </button>
            ))}
          </motion.div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ChatInterface
            messages={messages}
            inputValue={inputValue}
            isLoading={isLoading}
            language={language}
            onInputChange={setInputValue}
            onSubmit={sendMessage}
          />
        </div>
      </main>

      {/* ── Voice button (floating) ───────────────────────────────────────── */}
      <div className="fixed bottom-24 right-6 z-40 sm:right-8">
        <VoiceButton
          language={language}
          onResult={handleVoiceResult}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
