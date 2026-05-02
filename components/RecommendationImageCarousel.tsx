"use client";

import Image from "next/image";
import type { TourismImage } from "@/types/tourism";

interface RecommendationImageCarouselProps {
  images: TourismImage[];
  title: string;
  language: "ar" | "en";
}

export default function RecommendationImageCarousel({
  images,
  title,
  language,
}: RecommendationImageCarouselProps) {
  const isAr = language === "ar";
  const visibleImages = images.slice(0, 5);

  if (visibleImages.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 text-center text-xs text-white/45">
        {isAr ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u0635\u0648\u0631 \u0645\u0648\u062b\u0642\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0642\u0639 \u062d\u0627\u0644\u064a\u064b\u0627" : "No verified images available yet"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative h-44 overflow-hidden rounded-xl bg-white/5">
        <Image
          src={visibleImages[0].url}
          alt={visibleImages[0].alt[language] || title}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover transition-transform duration-300 hover:scale-105"
        />
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white/85 backdrop-blur">
          {visibleImages.length} {isAr ? "\u0635\u0648\u0631 \u0645\u0648\u062b\u0642\u0629" : "verified photos"}
        </div>
      </div>

      {visibleImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {visibleImages.slice(1).map((image) => (
            <div key={image.url} className="relative h-16 overflow-hidden rounded-lg bg-white/5">
              <Image
                src={image.url}
                alt={image.alt[language] || title}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
