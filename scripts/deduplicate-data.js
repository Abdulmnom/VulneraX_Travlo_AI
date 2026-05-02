/**
 * deduplicate-data.js
 *
 * Cleans and deduplicates data.json:
 * 1. Removes duplicate destinations (same name + region)
 * 2. Merges inconsistent data across duplicates
 * 3. Maps categories to system prompt format
 * 4. Fixes mismatched company names by region
 * 5. Corrects known crowd_level anomalies
 * 6. Re-numbers IDs sequentially
 *
 * Usage: node scripts/deduplicate-data.js
 */

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data.json");
const BACKUP_PATH = path.join(__dirname, "..", "data.json.backup");

// ── Category normalization map ────────────────────────────────────────────────
// data.json uses: beach, culture, desert, food, mountain, nature
// system prompt expects: nature, adventure, food, culture, shopping
const CATEGORY_MAP = {
  beach: "nature",
  desert: "adventure",
  mountain: "adventure",
  nature: "nature",
  culture: "culture",
  food: "food",
  shopping: "shopping",
};

// ── Company names by region ───────────────────────────────────────────────────
const COMPANY_BY_REGION = {
  Muscat: { en: "Oman Ministry of Tourism", ar: "وزارة السياحة العُمانية" },
  Dakhiliya: { en: "Nizwa Heritage Tourism", ar: "سياحة نزوى التراثية" },
  Dhofar: { en: "Salalah Tourism Authority", ar: "هيئة سياحة صلالة" },
  Sharqiya: { en: "Sharqiya Tourism Board", ar: "مجلس سياحة الشرقية" },
  Batinah: { en: "Batinah Coast Authority", ar: "هيئة ساحل الباطنة" },
  Dhahira: { en: "Dhahira Regional Tourism", ar: "سياحة منطقة الظاهرة" },
};

// ── Known crowd_level corrections (famous/notable places) ────────────────────
const CROWD_CORRECTIONS = {
  "National Museum": 4,
  "Al Jalali Fort": 3,
  "Al Mirani Fort": 3,
  "Bait Al Zubair Museum": 4,
  "Bandar Al Khayran": 3,
  "Muttrah Fish Market": 4,
  "Oman Aquarium": 3,
};

// ── Known souq/market destinations to add shopping category ──────────────────
const SHOPPING_KEYWORDS = ["souq", "souk", "market", "mall", "سوق", "تسوق"];

function normalizeCategories(categories, nameLower) {
  const normalized = new Set();

  for (const cat of categories) {
    const mapped = CATEGORY_MAP[cat.toLowerCase()];
    if (mapped) normalized.add(mapped);
  }

  // Add shopping for markets/souqs
  if (SHOPPING_KEYWORDS.some((kw) => nameLower.includes(kw))) {
    normalized.add("shopping");
  }

  return [...normalized];
}

function mergeGroup(group) {
  // Start with the entry having the highest crowd_level
  const sorted = [...group].sort((a, b) => b.crowd_level - a.crowd_level);
  const base = { ...sorted[0] };

  // Merge: union all recommended_months
  const allMonths = new Set();
  for (const d of group) {
    for (const m of d.recommended_months) allMonths.add(m);
  }
  base.recommended_months = [...allMonths].sort((a, b) => a - b);

  // Merge: highest crowd_level
  base.crowd_level = Math.max(...group.map((d) => d.crowd_level));

  // Merge: average non-zero ticket costs
  const costs = group.map((d) => d.ticket_cost_omr).filter((c) => c > 0);
  if (costs.length > 0) {
    base.ticket_cost_omr = Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 100) / 100;
  } else {
    base.ticket_cost_omr = 0.0;
  }

  // Merge: union categories
  const allCats = new Set();
  for (const d of group) {
    for (const c of d.categories) allCats.add(c);
  }
  base.categories = normalizeCategories([...allCats], base.name.en.toLowerCase());

  // Fix company by region
  const regionEn = base.region.en;
  if (COMPANY_BY_REGION[regionEn]) {
    base.company = COMPANY_BY_REGION[regionEn];
  }

  // Apply crowd corrections for known landmarks
  const nameEn = base.name.en;
  if (CROWD_CORRECTIONS[nameEn] !== undefined) {
    base.crowd_level = CROWD_CORRECTIONS[nameEn];
  }

  return base;
}

function main() {
  console.log("Reading data.json...");
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const destinations = JSON.parse(raw);
  console.log(`  Loaded ${destinations.length} destinations`);

  // Backup original
  fs.writeFileSync(BACKUP_PATH, raw, "utf8");
  console.log(`  Backup saved → data.json.backup`);

  // Group by name.en + region.en (deduplication key)
  const groups = new Map();
  for (const dest of destinations) {
    const key = `${dest.name.en.toLowerCase().trim()}|${dest.region.en.toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(dest);
  }

  console.log(`  Unique destinations: ${groups.size} (from ${destinations.length})`);

  // Merge each group
  const merged = [];
  for (const group of groups.values()) {
    merged.push(mergeGroup(group));
  }

  // Sort by region then name
  merged.sort((a, b) => {
    const regionCmp = a.region.en.localeCompare(b.region.en);
    if (regionCmp !== 0) return regionCmp;
    return a.name.en.localeCompare(b.name.en);
  });

  // Re-number IDs
  const clean = merged.map((dest, i) => ({
    ...dest,
    id: `dest_${String(i + 1).padStart(4, "0")}`,
  }));

  // Write result
  fs.writeFileSync(DATA_PATH, JSON.stringify(clean, null, 2), "utf8");

  // Stats
  const categoryCounts = {};
  for (const d of clean) {
    for (const c of d.categories) {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }
  }

  console.log("\n✅ Cleanup complete!");
  console.log(`  Before: ${destinations.length} destinations`);
  console.log(`  After:  ${clean.length} destinations`);
  console.log(`  Removed: ${destinations.length - clean.length} duplicates`);
  console.log("\nCategory distribution:");
  for (const [cat, count] of Object.entries(categoryCounts).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
}

main();
