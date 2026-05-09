"use client";

import { Clock, ExternalLink, Images, MapPin, Ticket, ShieldCheck, ShieldAlert, Shield, Info } from "lucide-react";
import type { Recommendation } from "@/lib/ollama";
import RecommendationImageCarousel from "./RecommendationImageCarousel";

interface RecommendationDetailsProps {
  rec: Recommendation;
  language: "ar" | "en";
}

function formatDuration(minutes?: number, language: "ar" | "en" = "en") {
  if (!minutes) return null;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return language === "ar" ? `${hours} \u0633\u0627\u0639\u0629 \u062a\u0642\u0631\u064a\u0628\u064b\u0627` : `About ${hours} hours`;
}

export default function RecommendationDetails({ rec, language }: RecommendationDetailsProps) {
  const isAr = language === "ar";
  const duration = formatDuration(rec.recommendedDurationMinutes, language);
  const labels = {
    highlights: isAr ? "\u0623\u0628\u0631\u0632 \u0645\u0627 \u064a\u0645\u064a\u0632 \u0627\u0644\u0645\u0648\u0642\u0639" : "Highlights",
    activities: isAr ? "\u0623\u0646\u0634\u0637\u0629 \u0645\u0642\u062a\u0631\u062d\u0629" : "Suggested activities",
    tips: isAr ? "\u0646\u0635\u0627\u0626\u062d \u0627\u0644\u0632\u064a\u0627\u0631\u0629" : "Travel tips",
    sources: isAr ? "\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0635\u0648\u0631" : "Image sources",
    hours: isAr ? "\u0627\u0644\u0623\u0648\u0642\u0627\u062a" : "Hours",
    ticket: isAr ? "\u0627\u0644\u062a\u0630\u0643\u0631\u0629" : "Ticket",
    map: isAr ? "\u0627\u0641\u062a\u062d \u0627\u0644\u062e\u0631\u064a\u0637\u0629" : "Open map",
    review: isAr ? "\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0642\u0639 \u064a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629 \u0635\u0648\u0631 \u0625\u0636\u0627\u0641\u064a\u0629" : "This place still needs more verified image review",
    costDetails: isAr ? "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062a\u0643\u0644\u0641\u0629" : "Cost details",
    entryOmani: isAr ? "\u062f\u062e\u0648\u0644 \u0639\u0645\u0627\u0646\u064a" : "Omani entry",
    entryTourist: isAr ? "\u062f\u062e\u0648\u0644 \u0633\u0627\u0626\u062d" : "Tourist entry",
    experienceCost: isAr ? "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u062a\u062c\u0631\u0628\u0629" : "Experience cost",
    includes: isAr ? "\u064a\u0634\u0645\u0644" : "Includes",
    dataStatus: isAr ? "\u062d\u0627\u0644\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a" : "Data status",
    lastUpdated: isAr ? "\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b" : "Last updated",
    confidence: isAr ? "\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062b\u0642\u0629" : "Confidence",
  };

  return (
    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
      <RecommendationImageCarousel images={rec.images ?? []} title={rec.name} language={language} />

      <div className="grid gap-2 text-xs text-white/65 sm:grid-cols-3">
        {rec.openingHours && (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <Clock size={14} className="text-amber-300" />
            <span>{labels.hours}: {rec.openingHours}</span>
          </div>
        )}
        {duration && (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <Images size={14} className="text-amber-300" />
            <span>{duration}</span>
          </div>
        )}
        {typeof rec.ticketCostOmr === "number" && (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <Ticket size={14} className="text-amber-300" />
            <span>{labels.ticket}: {rec.ticketCostOmr.toFixed(2)} OMR</span>
          </div>
        )}
      </div>

      {rec.highlights && rec.highlights.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-white">{labels.highlights}</h4>
          <ul className="grid gap-1.5 text-sm text-white/65">
            {rec.highlights.map((item) => (
              <li key={item} className="rounded-lg bg-white/5 px-3 py-2">{item}</li>
            ))}
          </ul>
        </section>
      )}

      {rec.activities && rec.activities.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-white">{labels.activities}</h4>
          <div className="flex flex-wrap gap-2">
            {rec.activities.map((activity) => (
              <span key={activity} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                {activity}
              </span>
            ))}
          </div>
        </section>
      )}

      {rec.travelTips && rec.travelTips.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-white">{labels.tips}</h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-white/65">
            {rec.travelTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      {rec.visitorCost && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-white">{labels.costDetails}</h4>
          <div className="rounded-lg bg-white/5 p-3 text-xs text-white/65 space-y-2">
            {rec.visitorCost.entryFee !== undefined && (
              <div className="flex items-center gap-2">
                <Ticket size={14} className="text-amber-300" />
                <span>
                  {rec.visitorCost.entryFee === null
                    ? isAr ? "رسوم الدخول: غير مؤكدة" : "Entry fee: unconfirmed"
                    : `${labels.entryOmani}: ${rec.visitorCost.entryFee.omani ?? (isAr ? "غير معروف" : "unknown")} OMR | ${labels.entryTourist}: ${rec.visitorCost.entryFee.tourist ?? (isAr ? "غير معروف" : "unknown")} OMR${rec.visitorCost.entryFee.notes ? ` — ${rec.visitorCost.entryFee.notes}` : ""}`}
                </span>
              </div>
            )}
            {rec.visitorCost.estimatedExperienceCost && (
              <div className="flex items-center gap-2">
                <Info size={14} className="text-amber-300" />
                <span>
                  {labels.experienceCost}: {rec.visitorCost.estimatedExperienceCost.min}-{rec.visitorCost.estimatedExperienceCost.max} {rec.visitorCost.estimatedExperienceCost.currency}
                  {rec.visitorCost.estimatedExperienceCost.includes.length > 0 && (
                    <> — {labels.includes}: {rec.visitorCost.estimatedExperienceCost.includes.join(", ")}</>
                  )}
                </span>
              </div>
            )}
            {rec.visitorCost.notes && (
              <div className="text-white/50">
                {rec.visitorCost.notes[language]}
              </div>
            )}
          </div>
        </section>
      )}

      {rec.dataVerification && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-white">{labels.dataStatus}</h4>
          <div className="rounded-lg bg-white/5 p-3 text-xs text-white/65 space-y-2">
            <div className="flex items-center gap-2">
              {rec.dataVerification.status === "verified" ? (
                <ShieldCheck size={14} className="text-green-400" />
              ) : rec.dataVerification.status === "pending_review" ? (
                <ShieldAlert size={14} className="text-yellow-400" />
              ) : (
                <Shield size={14} className="text-red-400" />
              )}
              <span className="capitalize">{rec.dataVerification.status.replace("_", " ")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Info size={14} className="text-amber-300" />
              <span>{labels.confidence}: {rec.dataVerification.confidence}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-300" />
              <span>{labels.lastUpdated}: {rec.dataVerification.lastUpdated}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {rec.dataVerification.dataQuality.hasImages && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-300">
                  {isAr ? "صور موثقة" : "Verified images"}
                </span>
              )}
              {rec.dataVerification.dataQuality.hasVerifiedCosts && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-300">
                  {isAr ? "تكاليف مؤكدة" : "Verified costs"}
                </span>
              )}
              {rec.dataVerification.dataQuality.hasOpeningHours && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-300">
                  {isAr ? "أوقات عمل" : "Opening hours"}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {rec.location?.mapUrl && (
          <a
            href={rec.location.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/25"
          >
            <MapPin size={13} />
            {labels.map}
          </a>
        )}
        {rec.needsImageReview && (
          <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 text-xs text-yellow-200">
            {labels.review}
          </span>
        )}
      </div>

      {rec.imageSources && rec.imageSources.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{labels.sources}</h4>
          <div className="flex flex-wrap gap-2">
            {rec.imageSources.map((source) => (
              <a
                key={source.sourceUrl}
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/45 hover:text-white/75"
              >
                {source.sourceName} · {source.license}
                <ExternalLink size={11} />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}