/**
 * enrich-data.js
 *
 * Enriches data.json with AI-generated descriptions using Claude API.
 * Adds: description (en/ar), tags, best_for, opening_hours, tips
 *
 * Runs AFTER deduplicate-data.js
 * Skips destinations that already have a description.
 * Saves progress after every 10 destinations (safe to re-run if interrupted).
 *
 * Usage: ANTHROPIC_API_KEY=sk-... node scripts/enrich-data.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_PATH = path.join(__dirname, "..", "data.json");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const USE_PROVIDER = ANTHROPIC_API_KEY ? "anthropic" : DEEPSEEK_API_KEY ? "deepseek" : null;

if (!USE_PROVIDER) {
  console.error("❌ No API key found. Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY");
  console.error("   Usage: ANTHROPIC_API_KEY=sk-... node scripts/enrich-data.js");
  console.error("      or: DEEPSEEK_API_KEY=sk-... node scripts/enrich-data.js");
  process.exit(1);
}

console.log(`🤖 Using provider: ${USE_PROVIDER}`);

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthsToStr(months) {
  return months.map((m) => MONTH_NAMES[m - 1]).join(", ");
}

function crowdToStr(level) {
  return ["Very Low","Low","Moderate","High","Very High"][level - 1] || "Unknown";
}

function callLLM(prompt) {
  if (USE_PROVIDER === "anthropic") return callClaude(prompt);
  return callDeepSeek(prompt);
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(new Error(parsed.error.message));
            else resolve(parsed.content[0].text);
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Claude timeout")); });
    req.write(body);
    req.end();
  });
}

function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 512,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const req = https.request(
      {
        hostname: "api.deepseek.com",
        path: "/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(new Error(parsed.error.message));
            else resolve(parsed.choices[0].message.content);
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("DeepSeek timeout")); });
    req.write(body);
    req.end();
  });
}

function buildPrompt(dest) {
  const cats = dest.categories.join(", ");
  const cost = dest.ticket_cost_omr === 0 ? "FREE" : `${dest.ticket_cost_omr} OMR`;
  const duration = dest.avg_visit_duration_minutes;
  const crowd = crowdToStr(dest.crowd_level);
  const months = monthsToStr(dest.recommended_months);

  return `You are a tourism expert on Oman. Generate accurate factual data for this verified destination:

Name: ${dest.name.en} (${dest.name.ar})
Region: ${dest.region.en}, Oman
Categories: ${cats}
Visit duration: ${duration} minutes
Entry: ${cost}
Crowd level: ${crowd}
Best months: ${months}

Return ONLY valid JSON (no markdown, no extra text):
{
  "description": {
    "en": "<2 concise factual sentences about what this place is and why it's worth visiting>",
    "ar": "<accurate Arabic translation of the English description>"
  },
  "tags": ["<4-6 keywords from: mosque, beach, fort, souq, museum, restaurant, park, wadi, mountain, desert, free, family-friendly, photography, historic, nature, adventure, iconic, local, cultural>"],
  "best_for": ["<2-4 from: families, couples, solo, adventure-seekers, culture-lovers, photographers, food-lovers, groups>"],
  "opening_hours": {
    "en": "<realistic opening hours, e.g. 'Sat–Thu 8AM–8PM, Fri 8AM–11AM & 4PM–8PM' or 'Open 24 hours'>",
    "ar": "<Arabic translation>"
  },
  "tips": {
    "en": "<one practical tip: dress code, parking, best time of day, or local custom>",
    "ar": "<Arabic translation>"
  }
}`;
}

async function enrichDestination(dest) {
  const prompt = buildPrompt(dest);
  const raw = await callLLM(prompt);

  // Strip any markdown fences if model added them
  const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
  const enrichment = JSON.parse(cleaned);

  return {
    ...dest,
    description: enrichment.description,
    tags: enrichment.tags,
    best_for: enrichment.best_for,
    opening_hours: enrichment.opening_hours,
    tips: enrichment.tips,
  };
}

async function main() {
  console.log("📖 Reading data.json...");
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const destinations = JSON.parse(raw);

  const toEnrich = destinations.filter((d) => !d.description);
  const alreadyDone = destinations.length - toEnrich.length;

  console.log(`  Total: ${destinations.length} destinations`);
  console.log(`  Already enriched: ${alreadyDone}`);
  console.log(`  To enrich: ${toEnrich.length}`);
  console.log("");

  if (toEnrich.length === 0) {
    console.log("✅ All destinations already enriched!");
    return;
  }

  const results = [...destinations];
  let successCount = 0;
  let errorCount = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < results.length; i++) {
    if (results[i].description) continue; // already enriched

    const dest = results[i];
    process.stdout.write(`  [${successCount + errorCount + 1}/${toEnrich.length}] ${dest.name.en}... `);

    try {
      results[i] = await enrichDestination(dest);
      successCount++;
      console.log("✅");
    } catch (err) {
      errorCount++;
      console.log(`❌ ${err.message}`);
      // Leave original without description — script can be re-run
    }

    // Save progress every BATCH_SIZE successes
    if ((successCount + errorCount) % BATCH_SIZE === 0) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(results, null, 2), "utf8");
      console.log(`  💾 Progress saved (${successCount} enriched so far)\n`);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  // Final save
  fs.writeFileSync(DATA_PATH, JSON.stringify(results, null, 2), "utf8");

  console.log("\n✅ Enrichment complete!");
  console.log(`  Enriched: ${successCount}`);
  console.log(`  Failed:   ${errorCount}`);
  if (errorCount > 0) {
    console.log("  Re-run this script to retry failed destinations.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
