# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package.json package-lock.json ./

# Install all dependencies (including devDeps needed for build)
RUN npm ci --prefer-offline

# Copy application source
COPY . .

# Build the Next.js production bundle
RUN npm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install Python, ffmpeg, and pip for faster-whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment and install faster-whisper
RUN python3 -m venv /opt/whisper-env && \
    /opt/whisper-env/bin/pip install --no-cache-dir faster-whisper

# Pre-download the Whisper base model so first request is fast
RUN /opt/whisper-env/bin/python -c \
    "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

# Create a non-root user for least-privilege execution
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy only what's needed to run the app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Python script for STT
COPY --from=builder --chown=nextjs:nodejs /app/lib/voice/whisper_transcribe.py ./lib/voice/whisper_transcribe.py

USER nextjs

EXPOSE 3000

# Standalone server entry point (Next.js standalone output mode)
CMD ["node", "server.js"]
