import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTenantContext, getTenantIdFromRequest } from "@/lib/tenant/tenantContext";
import { checkRateLimitWithContext } from "@/lib/security/multiTenantRateLimiter";
import { scanForAttacks, logAttack, type RequestContext } from "@/lib/security/attackDetector";

/**
 * Next.js Middleware
 *
 * Handles:
 * - Tenant context extraction from subdomain
 * - Rate limiting per tenant
 * - Attack detection and blocking
 * - CORS headers
 * - Security headers
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

// Paths that skip rate limiting
const SKIP_RATE_LIMIT_PATHS = [
  "/api/health",
  "/_next/",
  "/static/",
  "/favicon.ico",
];

// Paths that skip attack detection (static assets)
const SKIP_ATTACK_DETECTION_PATHS = [
  "/_next/",
  "/static/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

// CORS allowed origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "https://vulnerax.local",
  "https://*.vulnerax.local",
];

// ═══════════════════════════════════════════════════════════════════════════════
// Main Middleware
// ═══════════════════════════════════════════════════════════════════════════════

export async function middleware(req: NextRequest) {
  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;

  // ── 1. Extract Tenant Context ───────────────────────────────────────────────
  const tenantContext = getTenantContext(req);
  const tenantId = tenantContext.id;

  // Reject invalid tenants on API routes
  if (path.startsWith("/api/") && !tenantContext.isValid) {
    return NextResponse.json(
      { error: "Invalid tenant", tenant: tenantId },
      { status: 403 }
    );
  }

  // ── 2. Get Client IP ────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";

  // ── 3. Rate Limiting ────────────────────────────────────────────────────────
  if (!shouldSkipRateLimit(path)) {
    const rateLimitResult = checkRateLimitWithContext(tenantId, ip, path);

    if (!rateLimitResult.allowed) {
      console.warn(
        `[Middleware] Rate limit exceeded: ${ip} (tenant: ${tenantId}, tier: ${rateLimitResult.tier})`
      );

      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateLimitResult.resetMs / 1000)),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(
              Math.ceil((Date.now() + rateLimitResult.resetMs) / 1000)
            ),
          },
        }
      );
    }
  }

  // ── 4. Attack Detection ─────────────────────────────────────────────────────
  if (!shouldSkipAttackDetection(path)) {
    const requestContext: RequestContext = {
      tenantId,
      ip,
      path,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: Date.now(),
    };

    // Scan URL and query params
    const urlToScan = `${path}${url.search}`;
    const attacks = scanForAttacks(urlToScan, requestContext);

    // Scan body for POST/PUT/PATCH requests
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      try {
        const body = await req.clone().text();
        const bodyAttacks = scanForAttacks(body, requestContext);
        attacks.push(...bodyAttacks);
      } catch {
        // Ignore body parsing errors
      }
    }

    // Block if attacks detected
    const blockedAttacks = attacks.filter((a) => a.blocked);
    if (blockedAttacks.length > 0) {
      // Log all detected attacks
      for (const attack of attacks) {
        logAttack(attack, requestContext, urlToScan);
      }

      console.warn(
        `[Middleware] Blocked attack: ${blockedAttacks
          .map((a) => a.type)
          .join(", ")} from ${ip} (tenant: ${tenantId})`
      );

      return NextResponse.json(
        {
          error: "Request blocked due to security policy violation",
          code: "SECURITY_VIOLATION",
        },
        { status: 403 }
      );
    }

    // Log non-blocked detections (bots, etc.)
    for (const attack of attacks) {
      if (!attack.blocked) {
        logAttack(attack, requestContext, urlToScan);
      }
    }
  }

  // ── 5. Create Response with Security Headers ────────────────────────────────
  const response = NextResponse.next();

  // Add security headers
  addSecurityHeaders(response);

  // Add tenant context headers (for downstream use)
  response.headers.set("X-Tenant-ID", tenantId);
  response.headers.set("X-Tenant-Tier", tenantContext.tier);

  // Add rate limit headers if not skipped
  if (!shouldSkipRateLimit(path)) {
    const rateLimitStatus = checkRateLimitWithContext(tenantId, ip, path);
    response.headers.set(
      "X-RateLimit-Limit",
      String(rateLimitStatus.remaining + (rateLimitStatus.allowed ? 1 : 0))
    );
    response.headers.set("X-RateLimit-Remaining", String(rateLimitStatus.remaining));
  }

  // Add timing header
  const duration = Date.now() - startTime;
  response.headers.set("X-Response-Time", `${duration}ms`);

  return response;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function shouldSkipRateLimit(path: string): boolean {
  return SKIP_RATE_LIMIT_PATHS.some((p) => path.startsWith(p));
}

function shouldSkipAttackDetection(path: string): boolean {
  return SKIP_ATTACK_DETECTION_PATHS.some((p) => path.startsWith(p));
}

function addSecurityHeaders(response: NextResponse): void {
  // Clickjacking protection
  response.headers.set("X-Frame-Options", "SAMEORIGIN");

  // MIME sniffing protection
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(self), camera=(self), microphone=(self), payment=(), usb=(), vr=()"
  );

  // Remove server identification
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Matcher Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
