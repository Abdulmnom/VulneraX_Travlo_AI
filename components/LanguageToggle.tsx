"use client";

/**
 * LanguageToggle – AR / EN pill switch
 *
 * Updates the <html> dir attribute for RTL support and calls onChange.
 */

import { motion } from "framer-motion";

interface LanguageToggleProps {
  language: "ar" | "en";
  onChange: (lang: "ar" | "en") => void;
}

export default function LanguageToggle({
  language,
  onChange,
}: LanguageToggleProps) {
  const handleChange = (lang: "ar" | "en") => {
    onChange(lang);
    // Update document direction for RTL/LTR
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
  };

  return (
    <div
      className="relative flex items-center rounded-full bg-white/10 p-1 gap-1"
      role="group"
      aria-label="Language selection"
    >
      {(["en", "ar"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => handleChange(lang)}
          className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
            language === lang
              ? "text-slate-900"
              : "text-white/60 hover:text-white"
          }`}
        >
          {/* Sliding pill background */}
          {language === lang && (
            <motion.span
              layoutId="lang-pill"
              className="absolute inset-0 rounded-full bg-amber-400"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{lang === "en" ? "EN" : "عربي"}</span>
        </button>
      ))}
    </div>
  );
}
