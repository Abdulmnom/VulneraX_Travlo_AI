/**
 * In-Memory Rate Limiter
 *
 * Implements a sliding-window rate limiter keyed by IP address.
 * No external dependencies — runs entirely inside the Next.js process.
 *
 * Configured via environment variables:
 *   RATE_LIMIT_MAX         — max requests per window (default: 20)
 *   RATE_LIMIT_WINDOW_MS   — window duration in ms (default: 60000)
 */

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? "20", 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);

// Map of IP → array of request timestamps within the current window
const requestLog = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number; // ms until the oldest entry expires
}

/**
 * Check whether an IP address is within the rate limit.
 * Automatically prunes stale timestamps.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get existing timestamps for this IP, pruning any outside the window
  const timestamps = (requestLog.get(ip) ?? []).filter(
    (t) => t > windowStart
  );

  if (timestamps.length >= MAX_REQUESTS) {
    // Rate limit exceeded — calculate reset time
    const oldestTimestamp = timestamps[0];
    const resetMs = oldestTimestamp + WINDOW_MS - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  // Record this request
  timestamps.push(now);
  requestLog.set(ip, timestamps);

  return {
    allowed: true,
    remaining: MAX_REQUESTS - timestamps.length,
    resetMs: WINDOW_MS,
  };
}

/**
 * Periodically clean up expired entries to prevent unbounded memory growth.
 * Called on module load — runs every 5 minutes.
 */
function startCleanup() {
  if (typeof setInterval === "undefined") return; // Guard for edge runtimes
  setInterval(() => {
    const windowStart = Date.now() - WINDOW_MS;
    for (const [ip, timestamps] of requestLog.entries()) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        requestLog.delete(ip);
      } else {
        requestLog.set(ip, active);
      }
    }
  }, 5 * 60 * 1000);
}

startCleanup();
