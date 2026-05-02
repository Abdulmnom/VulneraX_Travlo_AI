import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
require.extensions[".json"] = (module, filename) => {
  module.exports = JSON.parse(readFileSync(filename, "utf8"));
};

const { loadTourismData } = await import(
  pathToFileURL("lib/rag/tourismData.ts").href
);
const { searchTourismSites } = await import(
  pathToFileURL("lib/rag/search.ts").href
);
const { hydrateRecommendationsWithRag } = await import(
  pathToFileURL("lib/rag/format.ts").href
);

const sites = loadTourismData();
assert.equal(sites.length, 103);

const withVerifiedImages = sites.filter((site) => site.images.length >= 3);
assert.ok(withVerifiedImages.length >= 7);
assert.ok(withVerifiedImages.every((site) => site.images.every((image) => image.verified)));

const mosqueResults = searchTourismSites("Sultan Qaboos Grand Mosque", 1);
assert.equal(mosqueResults[0]?.id, "dest_0085");
assert.equal(mosqueResults[0]?.images.length, 3);

const arabicResults = searchTourismSites("جامع السلطان قابوس", 1);
assert.equal(arabicResults[0]?.id, "dest_0085");

const hydrated = hydrateRecommendationsWithRag(
  [
    {
      name: "Wadi Shab",
      category: "nature",
      description: "A beautiful wadi.",
      emoji: "🏞️",
    },
  ],
  "en"
);

assert.equal(hydrated[0].id, "dest_0086");
assert.equal(hydrated[0].images?.length, 3);
assert.ok(hydrated[0].location?.mapUrl.includes("google.com/maps"));

console.log("RAG smoke test passed");