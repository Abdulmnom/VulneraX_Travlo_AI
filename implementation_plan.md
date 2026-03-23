# Travlo – Voice-Activated Tourism Platform (MVP)

A fully local, privacy-first tourism AI platform for Oman. Tourists interact via voice or text (Arabic/English), and receive structured AI recommendations powered by a local Ollama LLM — no internet required after initial Docker pull.

## Architecture Diagram

```
Browser
  │
  ▼
[Nginx :80]  ← only exposed port
  │
  ▼
[Next.js :3000]  ← App Router, API Routes
  │
  ├──→ [Ollama :11434]  ← local LLM (Qwen2.5 or llama3)
  │
  └──→ [MongoDB :27017] ← optional: store session/recommendation cache
  
All services on internal Docker network: travlo_net
```

---

## Proposed Changes

### Infrastructure

#### [MODIFY] [Dockerfile](file:///c:/Users/user/Desktop/MY_Work/VulneraX/Travlo_AI/dockerFile-Next.yml) → renamed to `Dockerfile`
- Fix corrupted syntax (spaces in `FROM node: 18-alpine`, `WORKDIR / app`, etc.)
- Multi-stage build: builder → production runner
- Non-root `appuser`, `--chown` on COPY
- Minimal final image

#### [MODIFY] [docker-compose.yml](file:///c:/Users/user/Desktop/MY_Work/VulneraX/Travlo_AI/docker-compose.yml)
- 4 services: `nginx`, `nextjs`, `ollama`, `mongodb`
- Internal network `travlo_net` (internal: true) — no internet egress
- Only Nginx port 80 exposed to host
- Volumes: `ollama_data`, `mongo_data`
- Env vars via `.env` / `env_file`
- Health checks on `ollama` and `mongodb`

#### [NEW] nginx/nginx.conf
- Reverse proxy to `nextjs:3000`
- Rate limiting (10 req/s per IP)
- Security headers (no-sniff, XSS, HSTS)
- Gzip compression

#### [NEW] .env.example
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MONGODB_URI`, `RATE_LIMIT_MAX`

---

### App Core (lib/)

#### [NEW] lib/ollama.ts
- Typed `OllamaClient` class
- `chat(messages)` → streams or returns structured JSON
- Tourism system prompt (bilingual Oman expert, no hallucinations)
- Validates response, strips malicious content

#### [NEW] lib/rateLimiter.ts
- Simple in-memory sliding-window rate limiter
- Configurable via env (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`)
- Keyed by IP address

#### [NEW] lib/sanitize.ts
- Strips HTML/script tags
- Blocks prompt injection patterns (`ignore previous`, `jailbreak`, etc.)
- Max input length enforcement

#### [NEW] lib/qr.ts
- Generates a session URL (e.g. `http://localhost/?session=<id>`)
- Returns string for `qrcode.react` to render

---

### API Routes

#### [NEW] app/api/chat/route.ts
- `POST /api/chat`
- Rate limit check → sanitize input → build prompt → call Ollama → return structured JSON
- Returns: `{ recommendations: [{ name, category, description, emoji }] }`
- Edge cases: empty input, Ollama down, malformed response

#### [NEW] app/api/health/route.ts
- `GET /api/health` — returns `{ status: "ok", ollama: bool, mongo: bool }`

---

### UI Components

#### [NEW] components/VoiceButton.tsx
- Uses `Web Speech API` (`SpeechRecognition`)
- Language auto-detected (user sets AR/EN)
- Animated mic button (framer-motion pulse when recording)
- Falls back gracefully if browser doesn't support

#### [NEW] components/ChatInterface.tsx
- Message history (user + AI turns)
- Auto-scrolls to latest message
- Shows spinner while AI is thinking
- RTL support for Arabic messages

#### [NEW] components/RecommendationCard.tsx
- Displays: emoji, name, category badge, description
- Hover animation (framer-motion)
- Mobile-responsive grid

#### [NEW] components/QRModal.tsx
- Uses `qrcode.react` for QR rendering
- Modal opens on button click
- Encodes session link

#### [NEW] components/LanguageToggle.tsx
- AR / EN pill toggle
- Updates `lang` attribute on `<html>` for RTL

#### [MODIFY] app/page.tsx
- Assembles all components
- Manages state: messages, language, session, recommendations

#### [MODIFY] app/layout.tsx
- Update metadata: title "Travlo | دليلك السياحي"
- Add `dir` support

#### [MODIFY] app/globals.css
- Full Travlo dark design system
- Arabic font support (Noto Sans Arabic)
- CSS custom properties for brand colors

---

## Verification Plan

### Manual Verification (Browser)

> **Run**: `npm run dev` in the project directory, then open `http://localhost:3000`

1. **UI Load**: Page loads with Travlo header, voice button, and language toggle
2. **Text Input**: Type "recommend a restaurant in Muscat" → AI cards appear
3. **Arabic Input**: Switch to AR, type "أوصني بمطعم في مسقط" → Cards appear in Arabic
4. **Voice Button**: Click mic → browser asks for mic permission → transcription appears in input
5. **QR Code**: Click QR button → modal opens with scannable code
6. **Rate Limiting**: Send 11 requests in 1 second → 12th returns 429

### Docker Verification

> **Run**: `docker-compose up -d --build` then open `http://localhost`

1. All 4 containers start (verify with `docker-compose ps`)
2. Nginx proxies to Next.js (page loads at port 80)
3. Next.js connects to Ollama (health endpoint: `GET /api/health`)
4. No containers have external network access (verify: `docker network inspect travlo_net`)

> [!IMPORTANT]
> Ollama model must be pulled before first run:
> `docker exec ollama_ai ollama pull qwen2.5:3b`

> [!NOTE]
> The existing [dockerFile-Next.yml](file:///c:/Users/user/Desktop/MY_Work/VulneraX/Travlo_AI/dockerFile-Next.yml) file has corrupted syntax and will be replaced with a proper `Dockerfile`. The original will be removed from the build context.
