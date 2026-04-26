/**
 * Multi-Tenant Rate Limiter
 * 
 * Implements tenant-aware rate limiting with:
 * - Per-tenant rate limits (isolated between tenants)
 * - Per-IP rate limits within each tenant
 * - Different tiers for different endpoints (general, api, auth)
 * - Automatic blocklist for repeat offenders
 */

import { getTenantContext } from "@/lib/tenant/tenantContext";

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  // Rate limit tiers
  tiers: {
    general: {
      maxRequests: parseInt(process.env.RATE_LIMIT_GENERAL ?? "100", 10),
      windowMs: 60000, // 1 minute
    },
    api: {
      maxRequests: parseInt(process.env.RATE_LIMIT_API ?? "30", 10),
      windowMs: 60000,
    },
    auth: {
      maxRequests: parseInt(process.env.RATE_LIMIT_AUTH ?? "5", 10),
      windowMs: 60000,
    },
  },
  
  // Blocklist settings
  blocklist: {
    maxViolations: 5,
    blockDurationMs: parseInt(process.env.BLOCK_DURATION_MS ?? "900000", 10), // 15 minutes
  },
  
  // Cleanup interval
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  blocked: boolean;
  tier: RateLimitTier;
}

export type RateLimitTier = "general" | "api" | "auth";

interface RequestLog {
  timestamps: number[];
  violations: number;
  blockedUntil?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory Store
// ═══════════════════════════════════════════════════════════════════════════════
// Structure: tenantId -> ip -> endpointTier -> RequestLog
const rateLimitStore = new Map<string, Map<string, Map<RateLimitTier, RequestLog>>>();

// ═══════════════════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check rate limit for a request
 * This is tenant-aware: same IP has different limits for different tenants
 */
export function checkMultiTenantRateLimit(
  tenantId: string,
  ip: string,
  tier: RateLimitTier = "general"
): RateLimitResult {
  const now = Date.now();
  const config = CONFIG.tiers[tier];
  const windowStart = now - config.windowMs;
  
  // Get or create tenant store
  if (!rateLimitStore.has(tenantId)) {
    rateLimitStore.set(tenantId, new Map());
  }
  const tenantStore = rateLimitStore.get(tenantId)!;
  
  // Get or create IP store
  if (!tenantStore.has(ip)) {
    tenantStore.set(ip, new Map());
  }
  const ipStore = tenantStore.get(ip)!;
  
  // Get or create tier log
  if (!ipStore.has(tier)) {
    ipStore.set(tier, { timestamps: [], violations: 0 });
  }
  const log = ipStore.get(tier)!;
  
  // Check if IP is blocked
  if (log.blockedUntil && now < log.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: log.blockedUntil - now,
      blocked: true,
      tier,
    };
  }
  
  // Clear expired block
  if (log.blockedUntil && now >= log.blockedUntil) {
    log.blockedUntil = undefined;
    log.violations = 0;
  }
  
  // Prune old timestamps
  log.timestamps = log.timestamps.filter((t) => t > windowStart);
  
  // Check if over limit
  if (log.timestamps.length >= config.maxRequests) {
    // Record violation
    log.violations++;
    
    // Check if should block
    if (log.violations >= CONFIG.blocklist.maxViolations) {
      log.blockedUntil = now + CONFIG.blocklist.blockDurationMs;
      console.warn(`[Security] IP ${ip} blocked in tenant ${tenantId} for tier ${tier}`);
    }
    
    const oldestTimestamp = log.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestTimestamp + config.windowMs - now,
      blocked: log.violations >= CONFIG.blocklist.maxViolations,
      tier,
    };
  }
  
  // Record this request
  log.timestamps.push(now);
  
  return {
    allowed: true,
    remaining: config.maxRequests - log.timestamps.length,
    resetMs: config.windowMs,
    blocked: false,
    tier,
  };
}

/**
 * Check rate limit using tenant context from request
 */
export function checkRateLimitWithContext(
  tenantId: string,
  ip: string,
  path: string
): RateLimitResult {
  // Determine tier based on path
  let tier: RateLimitTier = "general";
  
  if (path.startsWith("/api/auth/") || path.startsWith("/auth/")) {
    tier = "auth";
  } else if (path.startsWith("/api/")) {
    tier = "api";
  }
  
  return checkMultiTenantRateLimit(tenantId, ip, tier);
}

/**
 * Get rate limit status for an IP (without consuming quota)
 */
export function getRateLimitStatus(
  tenantId: string,
  ip: string,
  tier: RateLimitTier = "general"
): Omit<RateLimitResult, "allowed"> {
  const config = CONFIG.tiers[tier];
  const windowStart = Date.now() - config.windowMs;
  
  const tenantStore = rateLimitStore.get(tenantId);
  if (!tenantStore) {
    return { remaining: config.maxRequests, resetMs: config.windowMs, blocked: false, tier };
  }
  
  const ipStore = tenantStore.get(ip);
  if (!ipStore) {
    return { remaining: config.maxRequests, resetMs: config.windowMs, blocked: false, tier };
  }
  
  const log = ipStore.get(tier);
  if (!log) {
    return { remaining: config.maxRequests, resetMs: config.windowMs, blocked: false, tier };
  }
  
  const now = Date.now();
  
  // Check blocked status
  if (log.blockedUntil && now < log.blockedUntil) {
    return {
      remaining: 0,
      resetMs: log.blockedUntil - now,
      blocked: true,
      tier,
    };
  }
  
  // Count active requests
  const activeCount = log.timestamps.filter((t) => t > windowStart).length;
  const oldestTimestamp = log.timestamps.find((t) => t > windowStart);
  
  return {
    remaining: Math.max(0, config.maxRequests - activeCount),
    resetMs: oldestTimestamp ? oldestTimestamp + config.windowMs - now : config.windowMs,
    blocked: false,
    tier,
  };
}

/**
 * Manually block an IP (for security responses)
 */
export function blockIP(
  tenantId: string,
  ip: string,
  durationMs: number = CONFIG.blocklist.blockDurationMs
): void {
  const tenantStore = rateLimitStore.get(tenantId) ?? new Map();
  const ipStore = tenantStore.get(ip) ?? new Map();
  
  for (const tier of ["general", "api", "auth"] as RateLimitTier[]) {
    const log = ipStore.get(tier) ?? { timestamps: [], violations: 0 };
    log.blockedUntil = Date.now() + durationMs;
    log.violations = CONFIG.blocklist.maxViolations;
    ipStore.set(tier, log);
  }
  
  tenantStore.set(ip, ipStore);
  rateLimitStore.set(tenantId, tenantStore);
  
  console.warn(`[Security] IP ${ip} manually blocked in tenant ${tenantId} for ${durationMs}ms`);
}

/**
 * Unblock an IP
 */
export function unblockIP(tenantId: string, ip: string): void {
  const tenantStore = rateLimitStore.get(tenantId);
  if (!tenantStore) return;
  
  const ipStore = tenantStore.get(ip);
  if (!ipStore) return;
  
  for (const [tier, log] of ipStore) {
    log.blockedUntil = undefined;
    log.violations = 0;
  }
  
  console.info(`[Security] IP ${ip} unblocked in tenant ${tenantId}`);
}

/**
 * Get blocked IPs for a tenant
 */
export function getBlockedIPs(tenantId: string): Array<{ ip: string; blockedUntil: number }> {
  const tenantStore = rateLimitStore.get(tenantId);
  if (!tenantStore) return [];
  
  const blocked: Array<{ ip: string; blockedUntil: number }> = [];
  const now = Date.now();
  
  for (const [ip, ipStore] of tenantStore) {
    for (const [tier, log] of ipStore) {
      if (log.blockedUntil && log.blockedUntil > now) {
        blocked.push({ ip, blockedUntil: log.blockedUntil });
        break; // Only list once per IP
      }
    }
  }
  
  return blocked;
}

/**
 * Get all rate limit statistics for a tenant
 */
export function getTenantStats(tenantId: string): {
  totalIPs: number;
  blockedIPs: number;
  activeRequests: number;
} {
  const tenantStore = rateLimitStore.get(tenantId);
  if (!tenantStore) {
    return { totalIPs: 0, blockedIPs: 0, activeRequests: 0 };
  }
  
  const now = Date.now();
  let blockedCount = 0;
  let activeRequests = 0;
  
  for (const [ip, ipStore] of tenantStore) {
    let isBlocked = false;
    
    for (const [tier, log] of ipStore) {
      if (log.blockedUntil && log.blockedUntil > now) {
        isBlocked = true;
      }
      
      for (const windowMs of Object.values(CONFIG.tiers).map((t) => t.windowMs)) {
        activeRequests += log.timestamps.filter((t) => t > now - windowMs).length;
      }
    }
    
    if (isBlocked) blockedCount++;
  }
  
  return {
    totalIPs: tenantStore.size,
    blockedIPs: blockedCount,
    activeRequests,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════════════════════════
function startCleanup() {
  if (typeof setInterval === "undefined") return;
  
  setInterval(() => {
    const now = Date.now();
    let cleanedEntries = 0;
    
    for (const [tenantId, tenantStore] of rateLimitStore) {
      for (const [ip, ipStore] of tenantStore) {
        let hasActive = false;
        
        for (const [tier, log] of ipStore) {
          // Clean old timestamps
          for (const config of Object.values(CONFIG.tiers)) {
            const windowStart = now - config.windowMs;
            log.timestamps = log.timestamps.filter((t) => t > windowStart);
          }
          
          // Check if still relevant
          if (log.timestamps.length > 0 || (log.blockedUntil && log.blockedUntil > now)) {
            hasActive = true;
          } else {
            ipStore.delete(tier);
            cleanedEntries++;
          }
        }
        
        if (!hasActive) {
          tenantStore.delete(ip);
          cleanedEntries++;
        }
      }
      
      if (tenantStore.size === 0) {
        rateLimitStore.delete(tenantId);
        cleanedEntries++;
      }
    }
    
    if (cleanedEntries > 0) {
      console.log(`[RateLimit] Cleaned ${cleanedEntries} expired entries`);
    }
  }, CONFIG.cleanupIntervalMs);
}

startCleanup();
