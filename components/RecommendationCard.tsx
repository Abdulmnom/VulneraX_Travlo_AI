"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, Images, Ticket, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import type { Recommendation } from "@/lib/ollama";
import RecommendationDetails from "./RecommendationDetails";

const CATEGORY_STYLES: Record<
  Recommendation["category"],
  { label: string; labelAr: string; color: string; bg: string }
> = {
  food: {
    label: "Food & Drink",
    labelAr: "\u0637\u0639\u0627\u0645 \u0648\u0634\u0631\u0627\u0628",
    color: "text-orange-300",
    bg: "bg-orange-500/20 border-orange-500/30",
  },
  culture: {
    label: "Culture",
    labelAr: "\u062b\u0642\u0627\u0641\u0629",
    color: "text-purple-300",
    bg: "bg-purple-500/20 border-purple-500/30",
  },
  nature: {
    label: "Nature",
    labelAr: "\u0637\u0628\u064a\u0639\u0629",
    color: "text-green-300",
    bg: "bg-green-500/20 border-green-500/30",
  },
  adventure: {
    label: "Adventure",
    labelAr: "\u0645\u063a\u0627\u0645\u0631\u0629",
    color: "text-red-300",
    bg: "bg-red-500/20 border-red-500/30",
  },
  shopping: {
    label: "Shopping",
    labelAr: "\u062a\u0633\u0648\u0642",
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
  const [expanded, setExpanded] = useState(false);
  const primaryImage = rec.images?.[0];
  const durationHours = rec.recommendedDurationMinutes
    ? Math.round((rec.recommendedDurationMinutes / 60) * 10) / 10
    : null;
  const hasDetails = Boolean(rec.images?.length || rec.highlights?.length || rec.activities?.length);

  const verificationStatus = rec.dataVerification?.status;
  const verificationIcon =
    verificationStatus === "verified" ? (
      <ShieldCheck size={12} className="text-green-400" />
    ) : verificationStatus === "pending_review" ? (
      <ShieldAlert size={12} className="text-yellow-400" />
    ) : (
      <Shield size={12} className="text-red-400" />
    );
  const verificationLabel =
    verificationStatus === "verified"
      ? isAr
        ? "\u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0648\u062b\u0642\u0629"
        : "Verified data"
      : verificationStatus === "pending_review"
        ? isAr
          ? "\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629"
          : "Pending review"
        : isAr
          ? "\u064a\u062d\u062a\u0627\u062c \u062a\u062d\u0642\u0642"
          : "Needs verification";

  const experienceCost = rec.visitorCost?.estimatedExperienceCost;
  const entryFee = rec.visitorCost?.entryFee;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10 group"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {primaryImage && (
        <div className="-mx-5 -mt-5 mb-4 relative h-40 overflow-hidden bg-white/5">
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt[language] || rec.name}
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white/85">
            <Images size={12} />
            {rec.images?.length ?? 0}
          </span>
        </div>
      )}

      <div className="relative flex items-start gap-4">
        <span className="mt-0.5 flex-shrink-0 select-none text-3xl" aria-hidden="true">
          {rec.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <span
            className={`mb-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}
          >
            {isAr ? style.labelAr : style.label}
          </span>

          <h3 className="mb-1 truncate text-base font-semibold leading-snug text-white">
            {rec.name}
          </h3>

          <p className="line-clamp-3 text-sm leading-relaxed text-white/60">
            {rec.description}
          </p>

          {(durationHours || typeof rec.ticketCostOmr === "number" || experienceCost || verificationStatus) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
              {durationHours && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                  <Clock size={12} />
                  {isAr ? `${durationHours} \u0633\u0627\u0639\u0629` : `${durationHours}h`}
                </span>
              )}
              {typeof rec.ticketCostOmr === "number" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                  <Ticket size={12} />
                  {rec.ticketCostOmr.toFixed(2)} OMR
                </span>
              )}
              {experienceCost && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                  <Ticket size={12} />
                  {isAr
                    ? `~${experienceCost.min}-${experienceCost.max} ${experienceCost.currency}`
                    : `~${experienceCost.min}-${experienceCost.max} ${experienceCost.currency}`}
                </span>
              )}
              {verificationStatus && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                  {verificationIcon}
                  {verificationLabel}
                </span>
              )}
            </div>
          )}

          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-4 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-amber-200 transition hover:bg-white/10"
            >
              {expanded
                ? isAr
                  ? "\u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644"
                  : "Hide details"
                : isAr
                  ? "\u0639\u0631\u0636 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644 \u0648\u0627\u0644\u0635\u0648\u0631"
                  : "View details & photos"}
            </button>
          )}
        </div>
      </div>

      {expanded && <RecommendationDetails rec={rec} language={language} />}
    </motion.article>
  );
}