import { findTourismSiteForRecommendation, searchTourismSites } from "@/lib/rag/search";
import type { Recommendation } from "@/lib/ollama";
import type { TourismSite } from "@/types/tourism";

function detectLanguage(message: string): "ar" | "en" {
  return /[\u0600-\u06FF]/.test(message) ? "ar" : "en";
}

function mapUrl(site: TourismSite) {
  return `https://www.google.com/maps?q=${site.coordinates.lat},${site.coordinates.lng}`;
}

export function getTourismContextForPrompt(message: string) {
  const language = detectLanguage(message);
  const sites = searchTourismSites(message, 5);

  const context = sites
    .map((site, index) => {
      const lines = [
        `${index + 1}. id: ${site.id}`,
        `name: ${site.name[language]} / ${site.name.en}`,
        `region: ${site.region[language]}`,
        `categories: ${site.categories.join(", ")}`,
        `description: ${site.ragContent[language]}`,
        `openingHours: ${site.visitorInfo.openingHours[language]}`,
        `durationMinutes: ${site.visitorInfo.recommendedDurationMinutes}`,
        `ticketCostOmr: ${site.visitorInfo.ticketCostOmr}`,
        `activities: ${site.activities[language].join(", ")}`,
        `tips: ${site.travelTips[language].join(" ")}`,
        `verifiedImageCount: ${site.images.length}`,
      ];

      return lines.join("\n");
    })
    .join("\n\n");

  return { language, sites, context };
}

export function buildRagSystemPrompt(basePrompt: string, message: string) {
  const { context } = getTourismContextForPrompt(message);

  return `${basePrompt}

RAG tourism knowledge base:
Use ONLY the Oman destinations listed below when recommending places for this user request. Prefer destinations with verifiedImageCount >= 3 when relevant. Do not invent image URLs. Return destination names exactly as listed so the application can attach verified images and details from its local RAG data.

${context}`;
}

export function hydrateRecommendationsWithRag(
  recommendations: Recommendation[],
  language: "ar" | "en" = "en"
): Recommendation[] {
  return recommendations.map((recommendation) => {
    const site = findTourismSiteForRecommendation(recommendation.name);
    if (!site) return recommendation;

    return {
      ...recommendation,
      id: site.id,
      slug: site.slug,
      name: site.name[language] || site.name.en,
      description: site.details[language] || recommendation.description,
      images: site.images,
      highlights: site.highlights[language],
      activities: site.activities[language],
      openingHours: site.visitorInfo.openingHours[language],
      ticketCostOmr: site.visitorInfo.ticketCostOmr,
      recommendedDurationMinutes: site.visitorInfo.recommendedDurationMinutes,
      location: {
        lat: site.coordinates.lat,
        lng: site.coordinates.lng,
        mapUrl: mapUrl(site),
      },
      travelTips: site.travelTips[language],
      nearbyPlaces: site.nearbyPlaces,
      needsImageReview: site.needsImageReview,
      imageSources: site.images.map((image) => ({
        sourceName: image.sourceName,
        sourceUrl: image.sourceUrl,
        license: image.license,
      })),
    };
  });
}