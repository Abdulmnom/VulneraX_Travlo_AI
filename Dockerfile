# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

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
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for least-privilege execution
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy only what's needed to run the app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Standalone server entry point (Next.js standalone output mode)
CMD ["node", "server.js"]
