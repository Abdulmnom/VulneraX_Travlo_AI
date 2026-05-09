import rawDestinations from "@/data.json";
import { VERIFIED_IMAGES_BY_DESTINATION } from "@/lib/rag/verifiedImages";
import type { LocalizedText, RecommendationCategory, TourismImage, TourismSite, VisitorCost, DataVerification } from "@/types/tourism";

type RawDestination = {
  id: string;
  name: LocalizedText;
  lat: number;
  lng: number;
  region: LocalizedText;
  categories: string[];
  avg_visit_duration_minutes: number;
  ticket_cost_omr: number;
  recommended_months: number[];
  crowd_level: number;
  description: LocalizedText;
  opening_hours: LocalizedText;
  tips: LocalizedText;
  tags?: string[];
  best_for?: string[];
};

const CATEGORY_MAP: Record<string, RecommendationCategory> = {
  food: "food",
  culture: "culture",
  nature: "nature",
  adventure: "adventure",
  shopping: "shopping",
};

const REGION_AR: Record<string, string> = {
  Batinah: "\u0627\u0644\u0628\u0627\u0637\u0646\u0629",
  Dakhiliya: "\u0627\u0644\u062f\u0627\u062e\u0644\u064a\u0629",
  Dhahira: "\u0627\u0644\u0638\u0627\u0647\u0631\u0629",
  Dhofar: "\u0638\u0641\u0627\u0631",
  Muscat: "\u0645\u0633\u0642\u0637",
  Sharqiya: "\u0627\u0644\u0634\u0631\u0642\u064a\u0629",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readableCategory(category: RecommendationCategory, language: "ar" | "en") {
  const labels: Record<RecommendationCategory, LocalizedText> = {
    food: { en: "food and local markets", ar: "\u0627\u0644\u0637\u0639\u0627\u0645 \u0648\u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0645\u062d\u0644\u064a\u0629" },
    culture: { en: "culture and heritage", ar: "\u0627\u0644\u062b\u0642\u0627\u0641\u0629 \u0648\u0627\u0644\u062a\u0631\u0627\u062b" },
    nature: { en: "nature and scenery", ar: "\u0627\u0644\u0637\u0628\u064a\u0639\u0629 \u0648\u0627\u0644\u0645\u0646\u0627\u0638\u0631" },
    adventure: { en: "adventure and outdoor exploration", ar: "\u0627\u0644\u0645\u063a\u0627\u0645\u0631\u0629 \u0648\u0627\u0644\u0627\u0633\u062a\u0643\u0634\u0627\u0641" },
    shopping: { en: "shopping and local crafts", ar: "\u0627\u0644\u062a\u0633\u0648\u0642 \u0648\u0627\u0644\u062d\u0631\u0641 \u0627\u0644\u0645\u062d\u0644\u064a\u0629" },
  };

  return labels[category][language];
}

function normalizeLocalized(value: LocalizedText | undefined, fallback: string): LocalizedText {
  const hasReadableArabic = Boolean(value?.ar && /[\u0600-\u06FF]/.test(value.ar) && !value.ar.includes("Ø"));

  return {
    en: value?.en || fallback,
    ar: hasReadableArabic ? value!.ar : fallback,
  };
}

function buildHighlights(destination: RawDestination, language: "ar" | "en") {
  const categories = destination.categories
    .map((category) => CATEGORY_MAP[category])
    .filter(Boolean);
  const primaryCategory = categories[0] ?? "culture";
  const name = normalizeLocalized(destination.name, destination.name.en)[language];
  const region = normalizeLocalized(
    destination.region,
    destination.region.en
  )[language];

  if (language === "ar") {
    return [
      `${name} \u0645\u0646 \u0623\u0628\u0631\u0632 \u0648\u062c\u0647\u0627\u062a ${readableCategory(primaryCategory, "ar")} \u0641\u064a \u0645\u0646\u0637\u0642\u0629 ${region}.`,
      "\u0645\u0646\u0627\u0633\u0628 \u0644\u0644\u062a\u0635\u0648\u064a\u0631 \u0648\u0627\u0643\u062a\u0634\u0627\u0641 \u0627\u0644\u0637\u0627\u0628\u0639 \u0627\u0644\u0645\u062d\u0644\u064a \u0627\u0644\u0639\u0645\u0627\u0646\u064a.",
      "\u062e\u064a\u0627\u0631 \u062c\u064a\u062f \u0644\u0625\u0636\u0627\u0641\u062a\u0647 \u0636\u0645\u0646 \u0628\u0631\u0646\u0627\u0645\u062c \u0633\u064a\u0627\u062d\u064a \u0642\u0635\u064a\u0631 \u0623\u0648 \u0631\u062d\u0644\u0629 \u064a\u0648\u0645\u064a\u0629.",
    ];
  }

  return [
    `${name} is a notable ${readableCategory(primaryCategory, "en")} stop in ${region}.`,
    "Good for photography and discovering a local Omani setting.",
    "Works well as part of a short itinerary or day trip.",
  ];
}

function buildActivities(destination: RawDestination, language: "ar" | "en") {
  const categories = destination.categories;
  const activities = new Set<string>();

  if (language === "ar") {
    activities.add("\u0627\u0644\u062a\u0635\u0648\u064a\u0631");
    activities.add("\u0627\u0633\u062a\u0643\u0634\u0627\u0641 \u0627\u0644\u0645\u0648\u0642\u0639");
    if (categories.includes("nature")) activities.add("\u0627\u0644\u0645\u0634\u064a \u0648\u0645\u0634\u0627\u0647\u062f\u0629 \u0627\u0644\u0637\u0628\u064a\u0639\u0629");
    if (categories.includes("adventure")) activities.add("\u0627\u0644\u0645\u063a\u0627\u0645\u0631\u0627\u062a \u0627\u0644\u062e\u0641\u064a\u0641\u0629");
    if (categories.includes("culture")) activities.add("\u0627\u0644\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648\u0627\u0644\u062b\u0642\u0627\u0641\u0629");
    if (categories.includes("food")) activities.add("\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0637\u0639\u0627\u0645 \u0627\u0644\u0645\u062d\u0644\u064a");
    if (categories.includes("shopping")) activities.add("\u0634\u0631\u0627\u0621 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u0645\u062d\u0644\u064a\u0629");
  } else {
    activities.add("Photography");
    activities.add("Site exploration");
    if (categories.includes("nature")) activities.add("Walking and nature viewing");
    if (categories.includes("adventure")) activities.add("Light outdoor adventure");
    if (categories.includes("culture")) activities.add("Learning local history and culture");
    if (categories.includes("food")) activities.add("Trying local food");
    if (categories.includes("shopping")) activities.add("Shopping for local products");
  }

  return Array.from(activities);
}

function buildTravelTips(destination: RawDestination, language: "ar" | "en") {
  const tip = normalizeLocalized(destination.tips, "")[language];
  const tips = tip ? [tip] : [];

  if (language === "ar") {
    tips.push("\u062a\u062d\u0642\u0642 \u0645\u0646 \u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0642\u0633 \u0642\u0628\u0644 \u0627\u0644\u0632\u064a\u0627\u0631\u0629.");
    tips.push("\u0627\u062d\u0645\u0644 \u0645\u0627\u0621\u064b \u0643\u0627\u0641\u064a\u064b\u0627 \u0648\u0627\u062d\u0631\u0635 \u0639\u0644\u0649 \u0627\u062d\u062a\u0631\u0627\u0645 \u0627\u0644\u0639\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u062d\u0644\u064a\u0629.");
  } else {
    tips.push("Check the weather before visiting.");
    tips.push("Carry enough water and respect local customs.");
  }

  return tips;
}

function buildVisitorCost(destination: RawDestination): VisitorCost {
  const nameLower = destination.name.en.toLowerCase();
  const categories = destination.categories;
  const rawCost = destination.ticket_cost_omr;

  const isFreeForAll = categories.some((c) =>
    ["beach", "wadi", "souq", "market", "corniche", "park"].includes(c)
  ) || /beach|wadi\s|souq|corniche|park|spring/i.test(nameLower);

  const isFortOrMuseum = categories.some((c) =>
    ["fort", "castle", "museum", "palace"].includes(c)
  ) || /fort|castle|museum|palace/i.test(nameLower);

  const isUncertain = categories.some((c) =>
    ["cave", "reserve", "adventure", "desert"].includes(c)
  ) || /cave|reserve|turtle|dune|safari/i.test(nameLower);

  if (isFreeForAll) {
    return {
      entryFee: { omani: 0, tourist: 0, notes: "مجاني للجميع" },
      estimatedExperienceCost: {
        min: Math.max(0, Math.round(rawCost * 0.3 * 10) / 10),
        max: Math.max(1, Math.round(rawCost * 1.5 * 10) / 10),
        currency: "OMR",
        includes:
          categories.includes("nature")
            ? ["موقف سيارات", "تصوير", "تنزه"]
            : ["تصوير", "تنزه", "استكشاف"],
      },
    };
  }

  if (isFortOrMuseum) {
    return {
      entryFee: {
        omani: 0,
        tourist: rawCost > 0 ? Math.min(5, Math.round(rawCost * 10) / 10) : 0.5,
        notes: "مجاني للعمانيين، رسم رمزي للسياح",
      },
      estimatedExperienceCost: {
        min: Math.max(0.5, Math.round(rawCost * 0.5 * 10) / 10),
        max: Math.max(2, Math.round(rawCost * 2 * 10) / 10),
        currency: "OMR",
        includes: ["تذكرة دخول", "تصوير", "مرشد صوتي"],
      },
    };
  }

  if (isUncertain) {
    return {
      entryFee: null,
      estimatedExperienceCost: {
        min: Math.max(1, Math.round(rawCost * 0.5 * 10) / 10),
        max: Math.max(5, Math.round(rawCost * 2 * 10) / 10),
        currency: "OMR",
        includes: ["موقف سيارات", "تصوير", "أنشطة اختيارية"],
      },
      notes: {
        en: "Entry fee varies, please check locally",
        ar: "تختلف الرسوم، يرجى التحقق محلياً",
      },
    };
  }

  return {
    entryFee: {
      omani: rawCost > 0 ? Math.round(rawCost * 0.5 * 10) / 10 : 0,
      tourist: rawCost > 0 ? Math.round(rawCost * 10) / 10 : 0,
      notes: rawCost === 0 ? "مجاني للجميع" : undefined,
    },
    estimatedExperienceCost: {
      min: Math.max(0.5, Math.round(rawCost * 0.8 * 10) / 10),
      max: Math.max(2, Math.round(rawCost * 2.5 * 10) / 10),
      currency: "OMR",
      includes: ["تذكرة دخول", "موقف سيارات", "تصوير"],
    },
  };
}

function buildDataVerification(destination: RawDestination, images: TourismImage[]): DataVerification {
  const hasImages = images.length >= 3;
  const hasCosts = destination.ticket_cost_omr > 0 || /beach|wadi\s|souq|corniche|park|spring/i.test(destination.name.en.toLowerCase());
  const hasOpeningHours = Boolean(destination.opening_hours?.en && destination.opening_hours.en !== "Check locally before visiting");
  const hasAccessibility = true;

  let status: DataVerification["status"] = "unverified";
  let confidence: DataVerification["confidence"] = "low";

  if (hasImages && hasCosts && hasOpeningHours) {
    status = "verified";
    confidence = "high";
  } else if (hasImages || hasCosts) {
    status = "pending_review";
    confidence = "medium";
  }

  return {
    status,
    confidence,
    lastUpdated: new Date().toISOString().split("T")[0],
    dataQuality: {
      hasImages,
      imageCount: images.length,
      hasVerifiedCosts: hasCosts,
      hasOpeningHours,
      hasAccessibilityInfo: hasAccessibility,
    },
  };
}
function buildRagContent(destination: RawDestination, language: "ar" | "en") {
  const name = normalizeLocalized(destination.name, destination.name.en)[language];
  const region = normalizeLocalized(destination.region, destination.region.en)[language];
  const description = normalizeLocalized(destination.description, destination.description.en)[language];
  const categories = destination.categories
    .map((category) => CATEGORY_MAP[category])
    .filter(Boolean)
    .map((category) => readableCategory(category, language))
    .join(language === "ar" ? "\u060c " : ", ");

  if (language === "ar") {
    return `${name} \u064a\u0642\u0639 \u0641\u064a \u0645\u0646\u0637\u0642\u0629 ${region} \u0641\u064a \u0633\u0644\u0637\u0646\u0629 \u0639\u0645\u0627\u0646. \u064a\u0635\u0646\u0641 \u0636\u0645\u0646 ${categories}. ${description} \u0645\u062f\u0629 \u0627\u0644\u0632\u064a\u0627\u0631\u0629 \u0627\u0644\u0645\u0642\u062a\u0631\u062d\u0629 ${destination.avg_visit_duration_minutes} \u062f\u0642\u064a\u0642\u0629 \u062a\u0642\u0631\u064a\u0628\u064b\u0627\u060c \u0648\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0627\u0632\u062f\u062d\u0627\u0645 ${destination.crowd_level} \u0645\u0646 5.`;
  }

  return `${name} is located in the ${region} region of Oman. It is relevant for ${categories}. ${description} Suggested visit duration is about ${destination.avg_visit_duration_minutes} minutes, with crowd level ${destination.crowd_level} out of 5.`;
}

export function loadTourismData(): TourismSite[] {
  return (rawDestinations as RawDestination[]).map((destination) => {
    const categories = destination.categories
      .map((category) => CATEGORY_MAP[category])
      .filter(Boolean);
    const name = normalizeLocalized(destination.name, destination.name.en);
    const region = {
      en: destination.region.en,
      ar: REGION_AR[destination.region.en] ?? normalizeLocalized(destination.region, destination.region.en).ar,
    };
    const description = normalizeLocalized(destination.description, destination.description.en);
    const images = VERIFIED_IMAGES_BY_DESTINATION[destination.id] ?? [];
    const visitorCost = buildVisitorCost(destination);
    const dataVerification = buildDataVerification(destination, images);

    return {
      id: destination.id,
      slug: slugify(destination.name.en),
      name,
      region,
      categories,
      coordinates: {
        lat: destination.lat,
        lng: destination.lng,
      },
      summary: {
        en: description.en,
        ar: description.ar,
      },
      details: {
        en: description.en,
        ar: description.ar,
      },
      history: {
        en: `${name.en} reflects the natural, cultural, or everyday tourism character of ${region.en}, depending on the visitor's interests.`,
        ar: `${name.ar} \u064a\u0639\u0643\u0633 \u062c\u0627\u0646\u0628\u064b\u0627 \u0645\u0646 \u0627\u0644\u0637\u0628\u064a\u0639\u0629 \u0623\u0648 \u0627\u0644\u062b\u0642\u0627\u0641\u0629 \u0623\u0648 \u0627\u0644\u062d\u064a\u0627\u0629 \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0641\u064a \u0645\u0646\u0637\u0642\u0629 ${region.ar} \u0628\u062d\u0633\u0628 \u0627\u0647\u062a\u0645\u0627\u0645\u0627\u062a \u0627\u0644\u0632\u0627\u0626\u0631.`,
      },
      highlights: {
        en: buildHighlights(destination, "en"),
        ar: buildHighlights(destination, "ar"),
      },
      activities: {
        en: buildActivities(destination, "en"),
        ar: buildActivities(destination, "ar"),
      },
      visitorInfo: {
        openingHours: normalizeLocalized(destination.opening_hours, "Check locally before visiting"),
        recommendedDurationMinutes: destination.avg_visit_duration_minutes,
        ticketCostOmr: destination.ticket_cost_omr,
        cost: visitorCost,
        bestMonths: destination.recommended_months,
        crowdLevel: destination.crowd_level,
        accessibility: {
          en: categories.includes("adventure")
            ? "Outdoor terrain; plan suitable footwear and transport."
            : "Generally suitable for casual visits; check facilities before going.",
          ar: categories.includes("adventure")
            ? "\u0637\u0628\u064a\u0639\u0629 \u062e\u0627\u0631\u062c\u064a\u0629\u061b \u064a\u0641\u0636\u0644 \u062a\u062c\u0647\u064a\u0632 \u062d\u0630\u0627\u0621 \u0648\u0648\u0633\u064a\u0644\u0629 \u0646\u0642\u0644 \u0645\u0646\u0627\u0633\u0628\u0629."
            : "\u0645\u0646\u0627\u0633\u0628 \u063a\u0627\u0644\u0628\u064b\u0627 \u0644\u0644\u0632\u064a\u0627\u0631\u0627\u062a \u0627\u0644\u062e\u0641\u064a\u0641\u0629\u061b \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0642\u0628\u0644 \u0627\u0644\u0630\u0647\u0627\u0628.",
        },
      },
      images,
      nearbyPlaces: [],
      travelTips: {
        en: buildTravelTips(destination, "en"),
        ar: buildTravelTips(destination, "ar"),
      },
      ragContent: {
        en: buildRagContent(destination, "en"),
        ar: buildRagContent(destination, "ar"),
      },
      needsImageReview: images.length < 3,
      dataVerification,
    };
  });
}

export function getTourismSiteById(id: string) {
  return loadTourismData().find((site) => site.id === id);
}