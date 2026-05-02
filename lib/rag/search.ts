import { loadTourismData } from "@/lib/rag/tourismData";
import type { TourismSite } from "@/types/tourism";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function searchableText(site: TourismSite) {
  return normalize(
    [
      site.name.en,
      site.name.ar,
      site.region.en,
      site.region.ar,
      site.categories.join(" "),
      site.summary.en,
      site.summary.ar,
      site.details.en,
      site.details.ar,
      site.highlights.en.join(" "),
      site.highlights.ar.join(" "),
      site.activities.en.join(" "),
      site.activities.ar.join(" "),
      site.travelTips.en.join(" "),
      site.travelTips.ar.join(" "),
      site.ragContent.en,
      site.ragContent.ar,
    ].join(" ")
  );
}

function scoreSite(site: TourismSite, query: string) {
  const normalizedQuery = normalize(query);
  const tokens = tokenize(query);
  const haystack = searchableText(site);
  let score = 0;

  if (!tokens.length) return 0;

  if (normalize(site.name.en) === normalizedQuery || normalize(site.name.ar) === normalizedQuery) {
    score += 100;
  }

  if (normalize(site.name.en).includes(normalizedQuery) || normalize(site.name.ar).includes(normalizedQuery)) {
    score += 60;
  }

  for (const token of tokens) {
    if (normalize(site.name.en).includes(token) || normalize(site.name.ar).includes(token)) score += 20;
    if (site.categories.some((category) => category.includes(token))) score += 14;
    if (haystack.includes(token)) score += 4;
  }

  if (site.images.length >= 3) score += 3;

  return score;
}

export function searchTourismSites(query: string, limit = 5) {
  const sites = loadTourismData();
  const scored = sites
    .map((site) => ({ site, score: scoreSite(site, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.slice(0, limit).map((result) => result.site);
  }

  return sites
    .filter((site) => site.images.length >= 3)
    .slice(0, limit);
}

export function findTourismSiteForRecommendation(name: string) {
  const normalizedName = normalize(name);
  const sites = loadTourismData();

  return (
    sites.find((site) => normalize(site.name.en) === normalizedName || normalize(site.name.ar) === normalizedName) ??
    sites.find((site) => normalize(site.name.en).includes(normalizedName) || normalizedName.includes(normalize(site.name.en))) ??
    sites.find((site) => normalize(site.name.ar).includes(normalizedName) || normalizedName.includes(normalize(site.name.ar)))
  );
}