/**
 * test-voice-endpoint.mjs
 *
 * Tests POST /api/voice-assistant in two modes:
 *   1. Transcript mode  → sends pre-computed text (bypasses server STT)
 *   2. Audio file mode  → sends the MP3 file (uses server STT / fallback)
 *
 * Usage:
 *   node tests/test-voice-endpoint.mjs
 *
 * Requirements: Node 18+ (built-in fetch + FormData)
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/voice-assistant`;

// ── Helpers ──────────────────────────────────────────────────────────────────

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

function log(icon, color, label, msg) {
  console.log(`${color}${icon} ${BOLD}${label}${RESET}${color} ${msg}${RESET}`);
}

function separator(title) {
  console.log(`\n${CYAN}${"─".repeat(55)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(55)}${RESET}`);
}

async function runTest(label, formData) {
  log("🚀", CYAN, "Testing:", label);
  const startMs = Date.now();

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: formData,
    });

    const latency = Date.now() - startMs;
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      log("✅", GREEN, "Status:", `${res.status} OK  (${latency}ms)`);
      log("🎤", GREEN, "Transcript:", body.transcript ?? "(none)");
      log("🤖", GREEN, "Provider:", body.provider ?? "(none)");
      log("🌐", GREEN, "Language:", body.language ?? "(none)");
      log("⚡", GREEN, "Source:", body.source ?? "(none)");
      log("⏱ ", GREEN, "Latency:", `${body.latency_ms ?? latency}ms`);

      if (Array.isArray(body.recommendations) && body.recommendations.length > 0) {
        console.log(`\n${GREEN}  📍 Recommendations:${RESET}`);
        body.recommendations.forEach((r, i) => {
          console.log(`${GREEN}     ${i + 1}. ${r.emoji ?? ""} ${BOLD}${r.name}${RESET}${GREEN} [${r.category}]${RESET}`);
          console.log(`${GREEN}        ${r.description}${RESET}`);
        });
      }

      if (body.response) {
        console.log(`\n${GREEN}  🔊 Voice Response:${RESET}`);
        console.log(`${GREEN}     "${body.response}"${RESET}`);
      }
    } else {
      log("❌", RED, "Status:", `${res.status}  (${latency}ms)`);
      log("⚠️ ", RED, "Error:", body.error ?? JSON.stringify(body));
    }
  } catch (err) {
    log("💥", RED, "Request failed:", err.message);
    if (err.cause?.code === "ECONNREFUSED") {
      log("💡", YELLOW, "Hint:", "Make sure the dev server is running:  npm run dev");
    }
  }
}

// ── Test 1: Transcript mode (English) ────────────────────────────────────────

separator("TEST 1 — Transcript mode (English)");
console.log(`${YELLOW}  Sends: { transcript: 'Can you recommend...' }${RESET}`);
console.log(`${YELLOW}  Expected: 200 — bypasses server STT entirely${RESET}\n`);

{
  const fd = new FormData();
  fd.append("transcript", "Can you recommend a nice restaurant in Muscat?");
  await runTest("English transcript", fd);
}

// ── Test 2: Transcript mode (Arabic) ─────────────────────────────────────────

separator("TEST 2 — Transcript mode (Arabic)");
console.log(`${YELLOW}  Sends: { transcript: 'هل يمكنك...' }${RESET}`);
console.log(`${YELLOW}  Expected: 200 — Arabic response${RESET}\n`);

{
  const fd = new FormData();
  fd.append("transcript", "هل يمكنك أن توصي لي بأماكن سياحية في مسقط؟");
  await runTest("Arabic transcript", fd);
}

// ── Test 3: Audio file mode (MP3) ─────────────────────────────────────────────

separator("TEST 3 — Audio file mode (MP3)");
console.log(`${YELLOW}  Sends: test_en.mp3 as audio blob${RESET}`);
console.log(`${YELLOW}  Expected: 200 if Google Cloud STT is configured,${RESET}`);
console.log(`${YELLOW}            502 if STT service is unavailable (expected on local dev)${RESET}\n`);

const mp3Path = join(__dirname, "test_en.mp3");
if (existsSync(mp3Path)) {
  const mp3Buffer = readFileSync(mp3Path);
  const mp3Blob = new Blob([mp3Buffer], { type: "audio/mpeg" });

  const fd = new FormData();
  fd.append("audio", mp3Blob, "test_en.mp3");
  await runTest("MP3 audio file", fd);
} else {
  log("⚠️ ", YELLOW, "Skipped:", "test_en.mp3 not found — run generate_test_audio.py first");
}

// ── Test 4: History context ───────────────────────────────────────────────────

separator("TEST 4 — With conversation history");
console.log(`${YELLOW}  Sends transcript + previous chat turns${RESET}`);
console.log(`${YELLOW}  Expected: 200 — context-aware response${RESET}\n`);

{
  const history = [
    { role: "user",      content: "What is there to do in Muscat?" },
    { role: "assistant", content: "Muscat has the Sultan Qaboos Grand Mosque, Muttrah Souq, and the Royal Opera House." },
  ];

  const fd = new FormData();
  fd.append("transcript", "Tell me more about the Grand Mosque");
  fd.append("history", JSON.stringify(history));
  await runTest("Transcript + history", fd);
}

// ── Done ─────────────────────────────────────────────────────────────────────

console.log(`\n${CYAN}${"═".repeat(55)}`);
console.log(`  ✅  All tests complete`);
console.log(`${"═".repeat(55)}${RESET}\n`);
