"use client";

/**
 * Travlo – Main Page (v3)
 *
 * Features:
 *  ① Wake Word  – "Hello Travlo" → WakeWordModal → auto-opens mic
 *  ② Voice Enhancement  – raw transcript cleaned by Ollama
 *  ③ Auto-submit after voice  – no need to press Send
 *  ④ Conversation history  – full context on every LLM call
 *  ⑤ TTS  – AI replies read aloud (auto after voice, manual via Listen button)
 *  ⑥ Mic Permission Alert  – friendly guide when browser blocks mic
 *  ⑦ Toast notifications  – status feedback throughout
 */

import { useState, useCallback, useId, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import ChatInterface, { type Message } from "@/components/ChatInterface";
import LanguageToggle from "@/components/LanguageToggle";
import QRModal from "@/components/QRModal";
import WakeWordIndicator from "@/components/WakeWordIndicator";
import WakeWordModal from "@/components/WakeWordModal";
import MicPermissionAlert from "@/components/MicPermissionAlert";
import Toast, { useToast } from "@/components/Toast";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useTts } from "@/hooks/useTts";
import type { ConversationTurn, Recommendation } from "@/lib/ollama";

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

const WELCOME_MESSAGES: Record<"en" | "ar", string> = {
  en: 'Welcome! I\'m Travlo — your AI guide for Oman. Say "Hello Travlo" or tap the mic to start.',
  ar: 'أهلاً! أنا ترافلو — دليلك السياحي في عُمان. قل "مرحبا ترافلو" أو اضغط المايك للبدء.',
};

export default function Home() {
  const [language, setLanguage] = useState<"ar" | "en">("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState<string>(generateSessionId);
  const msgIdBase = useId();

  // ── Wake word state ──────────────────────────────────────────────────────
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTriggerKey, setVoiceTriggerKey] = useState(0);
  const [wakeModalOpen, setWakeModalOpen] = useState(false);
  const [detectedPhrase, setDetectedPhrase] = useState("");

  // ── Mic permission ───────────────────────────────────────────────────────
  const [micAlertOpen, setMicAlertOpen] = useState(false);

  // ── TTS ──────────────────────────────────────────────────────────────────
  const { speak, stop: stopSpeaking } = useTts(language);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // ── Toast ────────────────────────────────────────────────────────────────
  const { toast, showToast } = useToast();

  // ── Conversation history ─────────────────────────────────────────────────
  const conversationHistoryRef = useRef<ConversationTurn[]>([]);
  const lastInputWasVoiceRef = useRef(false);

  // ── TTS controls ─────────────────────────────────────────────────────────
  const handleSpeakMessage = useCallback(
    (msgId: string, text: string) => {
      setSpeakingMessageId(msgId);
      speak(text);
    },
    [speak]
  );

  const handleStopSpeaking = useCallback(() => {
    stopSpeaking();
    setSpeakingMessageId(null);
  }, [stopSpeaking]);

  // ── Wake/Stop word handler ───────────────────────────────────────────────
  const handleCommand = useCallback((type: "wake" | "stop", phrase: string) => {
    if (type === "stop") {
      handleStopSpeaking();
      showToast(language === "ar" ? "تم إيقاف المساعد" : "Assistant stopped", "info");
      return;
    }

    setDetectedPhrase(phrase);
    setWakeModalOpen(true);
    // 800ms delay gives the OS enough time to release the mic handle so the main recorder can attach
    setTimeout(() => {
      setVoiceTriggerKey((k) => k + 1);
    }, 800);
  }, [handleStopSpeaking, showToast, language]);

  const { isActive: wakeWordActive, permissionDenied } = useWakeWord({
    language,
    enabled: wakeWordEnabled,
    suspended: isVoiceListening || isLoading || wakeModalOpen,
    onCommand: handleCommand,
  });

  // Show mic permission alert when denied
  const prevPermissionDenied = useRef(false);
  if (permissionDenied && !prevPermissionDenied.current) {
    prevPermissionDenied.current = true;
    setMicAlertOpen(true);
  }
  if (!permissionDenied && prevPermissionDenied.current) {
    prevPermissionDenied.current = false;
  }

  // ── Core send ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (overrideText?: string, fromVoice = false) => {
      const text = (overrideText ?? inputValue).trim();
      if (!text || isLoading) return;

      // Close wake modal when user speaks
      setWakeModalOpen(false);

      const userMsgId = `${msgIdBase}-u-${Date.now()}`;
      const aiMsgId = `${msgIdBase}-a-${Date.now()}`;
      const historySnapshot = [...conversationHistoryRef.current];

      setMessages((prev) => [...prev, { id: userMsgId, role: "user", text }]);
      setInputValue("");
      setIsLoading(true);
      lastInputWasVoiceRef.current = fromVoice;
      stopSpeaking();
      setSpeakingMessageId(null);

      conversationHistoryRef.current = [
        ...historySnapshot,
        { role: "user", content: text },
      ];

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: historySnapshot }),
        });

        const data = await res.json();

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            { id: aiMsgId, role: "assistant", error: data.error || "An error occurred." },
          ]);
          showToast(language === "ar" ? "⚠️ حدث خطأ" : "⚠️ Something went wrong", "warning");
          return;
        }

        const recommendations: Recommendation[] = data.recommendations ?? [];
        setMessages((prev) => [
          ...prev,
          { id: aiMsgId, role: "assistant", recommendations },
        ]);

        const assistantSummary = recommendations
          .map((r) => `${r.name}: ${r.description}`)
          .join(" | ");
        conversationHistoryRef.current = [
          ...conversationHistoryRef.current,
          { role: "assistant", content: assistantSummary },
        ];

        // Auto-read after voice input
        if (fromVoice && recommendations.length > 0) {
          const speakText = recommendations.map((r) => `${r.name}. ${r.description}`).join(". ");
          setSpeakingMessageId(aiMsgId);
          speak(speakText);
        }
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
    },
    [inputValue, isLoading, language, msgIdBase, speak, stopSpeaking, showToast]
  );

  // ── Voice result (after Ollama enhancement) ───────────────────────────────
  const handleVoiceResult = useCallback(
    (transcript: string) => {
      if (!transcript.trim()) return;
      sendMessage(transcript, true);
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-[#0b0f1a]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-white/10 bg-white/3 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 max-w-4xl mx-auto w-full">
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
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">Travlo</h1>
              <p className="text-white/40 text-xs leading-none mt-0.5">
                {language === "ar" ? "دليل عُمان السياحي" : "Oman Tourism Guide"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <WakeWordIndicator
              enabled={wakeWordEnabled}
              isActive={wakeWordActive}
              language={language}
              onToggle={() => {
                setWakeWordEnabled((v) => {
                  const next = !v;
                  showToast(
                    next
                      ? language === "ar" ? '✅ قل "مرحبا ترافلو" للتنشيط' : '✅ Say "Hello Travlo" to activate'
                      : language === "ar" ? "🔕 تم تعطيل التنشيط الصوتي" : "🔕 Wake word disabled",
                    next ? "success" : "info"
                  );
                  return next;
                });
              }}
            />
            <QRModal sessionId={sessionId} language={language} />
            <LanguageToggle language={language} onChange={setLanguage} />
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 py-4">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/6 px-5 py-4 text-sm text-amber-200/80 leading-relaxed"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {WELCOME_MESSAGES[language]}
          </motion.div>
        )}

        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-2 mb-6"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {(language === "en"
              ? ["🍽️ Best restaurants in Muscat", "🏔️ Things to do in Nizwa", "🏖️ Beaches near Muscat", "🕌 Historic forts in Oman"]
              : ["🍽️ أفضل مطاعم مسقط", "🏔️ أماكن سياحية في نزوى", "🏖️ شواطئ قرب مسقط", "🕌 الحصون التاريخية في عُمان"]
            ).map((chip) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip.replace(/^[\p{Emoji}\s]+/u, "").trim())}
                className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
              >
                {chip}
              </button>
            ))}
          </motion.div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          <ChatInterface
            messages={messages}
            inputValue={inputValue}
            isLoading={isLoading}
            language={language}
            onInputChange={setInputValue}
            onSubmit={() => sendMessage()}
            onVoiceResult={handleVoiceResult}
            onListeningChange={(listening) => {
              setIsVoiceListening(listening);
              // Close wake modal once mic actually starts
              if (listening) setWakeModalOpen(false);
            }}
            speakingMessageId={speakingMessageId}
            onSpeakMessage={handleSpeakMessage}
            onStopSpeaking={handleStopSpeaking}
            voiceTriggerKey={voiceTriggerKey}
          />
        </div>
      </main>

      {/* ── Wake Word Modal ──────────────────────────────────────────────── */}
      <WakeWordModal
        open={wakeModalOpen}
        detectedPhrase={detectedPhrase}
        language={language}
        onDismiss={() => setWakeModalOpen(false)}
      />

      {/* ── Mic Permission Alert ─────────────────────────────────────────── */}
      <MicPermissionAlert
        open={micAlertOpen}
        language={language}
        onDismiss={() => setMicAlertOpen(false)}
        onRetry={() => {
          setMicAlertOpen(false);
          // Re-enable wake word to re-attempt permission
          setWakeWordEnabled(false);
          setTimeout(() => setWakeWordEnabled(true), 200);
        }}
      />

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      <Toast toast={toast} />
    </div>
  );
}
