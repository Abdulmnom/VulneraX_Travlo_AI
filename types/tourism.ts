export interface VisitorCost {
  entryFee: {
    omani?: number | null;
    tourist?: number | null;
    notes?: string;
  } | null;
  estimatedExperienceCost: {
    min: number;
    max: number;
    currency: "OMR";
    includes: string[];
  };
  notes?: {
    en: string;
    ar: string;
  };
}

export interface DataVerification {
  status: "verified" | "pending_review" | "unverified";
  confidence: "high" | "medium" | "low";
  lastUpdated: string;
  dataQuality: {
    hasImages: boolean;
    imageCount: number;
    hasVerifiedCosts: boolean;
    hasOpeningHours: boolean;
    hasAccessibilityInfo: boolean;
  };
}

export type LocalizedText = {
  en: string;
  ar: string;
};

export type RecommendationCategory =
  | "food"
  | "culture"
  | "nature"
  | "adventure"
  | "shopping";

export interface TourismImage {
  url: string;
  alt: LocalizedText;
  sourceName: string;
  sourceUrl: string;
  license: string;
  verified: boolean;
}

export interface TourismSite {
  id: string;
  slug: string;
  name: LocalizedText;
  region: LocalizedText;
  categories: RecommendationCategory[];
  coordinates: {
    lat: number;
    lng: number;
  };
  summary: LocalizedText;
  details: LocalizedText;
  history: LocalizedText;
  highlights: {
    en: string[];
    ar: string[];
  };
  activities: {
    en: string[];
    ar: string[];
  };
  visitorInfo: {
    openingHours: LocalizedText;
    recommendedDurationMinutes: number;
    ticketCostOmr: number;
    cost?: VisitorCost;
    bestMonths: number[];
    crowdLevel: number;
    accessibility: LocalizedText;
  };
  images: TourismImage[];
  nearbyPlaces: string[];
  travelTips: {
    en: string[];
    ar: string[];
  };
  ragContent: LocalizedText;
  needsImageReview: boolean;
  dataVerification?: DataVerification;
}
