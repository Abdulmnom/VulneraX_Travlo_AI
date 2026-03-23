"use client";

/**
 * RecommendationCard – Displays a single place/food/attraction recommendation
 */

import { motion } from "framer-motion";
import type { Recommendation } from "@/lib/ollama";

const CATEGORY_STYLES: Record<
  Recommendation["category"],
  { label: string; labelAr: string; color: string; bg: string }
> = {
  food: {
    label: "Food & Drink",
    labelAr: "طعام وشراب",
    color: "text-orange-300",
    bg: "bg-orange-500/20 border-orange-500/30",
  },
  culture: {
    label: "Culture",
    labelAr: "ثقافة",
    color: "text-purple-300",
    bg: "bg-purple-500/20 border-purple-500/30",
  },
  nature: {
    label: "Nature",
    labelAr: "طبيعة",
    color: "text-green-300",
    bg: "bg-green-500/20 border-green-500/30",
  },
  adventure: {
    label: "Adventure",
    labelAr: "مغامرة",
    color: "text-red-300",
    bg: "bg-red-500/20 border-red-500/30",
  },
  shopping: {
    label: "Shopping",
    labelAr: "تسوق",
    color: "text-blue-300",
    bg: "bg-blue-500/20 border-blue-500/30",
  },
};

interface RecommendationCardProps {
  rec: Recommendation;
  index: number;
  language: "ar" | "en";
}

export default function RecommendationCard({
  rec,
  index,
  language,
}: RecommendationCardProps) {
  const style = CATEGORY_STYLES[rec.category] ?? CATEGORY_STYLES.culture;
  const isAr = language === "ar";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="flex items-start gap-4">
        {/* Emoji icon */}
        <span
          className="text-3xl flex-shrink-0 mt-0.5 select-none"
          aria-hidden="true"
        >
          {rec.emoji}
        </span>

        <div className="flex-1 min-w-0">
          {/* Category badge */}
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium mb-2 ${style.bg} ${style.color}`}
          >
            {isAr ? style.labelAr : style.label}
          </span>

          {/* Place name */}
          <h3 className="text-white font-semibold text-base leading-snug mb-1 truncate">
            {rec.name}
          </h3>

          {/* Description */}
          <p className="text-white/60 text-sm leading-relaxed line-clamp-3">
            {rec.description}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
