/**
 * Tenant Context Management
 * 
 * Manages tenant identification and context from incoming requests.
 * Extracts tenant ID from subdomain and provides tenant-aware utilities.
 */

import { NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface TenantContext {
  id: string;
  name: string;
  tier: TenantTier;
  settings: TenantSettings;
  isValid: boolean;
}

export type TenantTier = "free" | "basic" | "pro" | "enterprise" | "admin";

export interface TenantSettings {
  maxRequestsPerMinute: number;
  maxAiTokensPerDay: number;
  features: string[];
  customDomain?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tenant Registry (In-Memory for now, can be moved to DB)
// ═══════════════════════════════════════════════════════════════════════════════

const TENANT_REGISTRY: Record<string, TenantContext> = {
  main: {
    id: "main",
    name: "VulneraX Main",
    tier: "enterprise",
    settings: {
      maxRequestsPerMinute: 200,
      maxAiTokensPerDay: 100000,
      features: ["chat", "voice", "analytics", "api"],
    },
    isValid: true,
  },
  tenant1: {
    id: "tenant1",
    name: "Tenant One",
    tier: "pro",
    settings: {
      maxRequestsPerMinute: 100,
      maxAiTokensPerDay: 50000,
      features: ["chat", "voice", "analytics"],
    },
    isValid: true,
  },
  tenant2: {
    id: "tenant2",
    name: "Tenant Two",
    tier: "basic",
    settings: {
      maxRequestsPerMinute: 50,
      maxAiTokensPerDay: 20000,
      features: ["chat"],
    },
    isValid: true,
  },
  admin: {
    id: "admin",
    name: "Admin Panel",
    tier: "admin",
    settings: {
      maxRequestsPerMinute: 500,
      maxAiTokensPerDay: 500000,
      features: ["chat", "voice", "analytics", "api", "admin", "security"],
    },
    isValid: true,
  },
  demo: {
    id: "demo",
    name: "Demo Tenant",
    tier: "free",
    settings: {
      maxRequestsPerMinute: 20,
      maxAiTokensPerDay: 5000,
      features: ["chat"],
    },
    isValid: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract tenant ID from hostname/subdomain
 * 
 * Examples:
 *   - vulnerax.local >> main
 *   - tenant1.vulnerax.local >> tenant1
 *   - www.vulnerax.local >> main
 */
export function extractTenantId(hostname: string): string {
  // Remove port if present
  const host = hostname.split(":")[0].toLowerCase();
  
  // Local development domains
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return process.env.DEFAULT_TENANT || "main";
  }
  
  // Check for subdomain pattern
  const domainMatch = host.match(/^([^.]+)\.(vulnerax\.local|vulnerax\.test|vulnerax\.com)$/);
  if (domainMatch) {
    const subdomain = domainMatch[1];
    
    // www redirects to main
    if (subdomain === "www") {
      return "main";
    }
    
    return subdomain;
  }
  
  // Exact domain match
  if (host === "vulnerax.local" || host === "vulnerax.test" || host === "vulnerax.com") {
    return "main";
  }
  
  // Check for custom domains
  for (const [id, tenant] of Object.entries(TENANT_REGISTRY)) {
    if (tenant.settings.customDomain === host) {
      return id;
    }
  }
  
  return process.env.DEFAULT_TENANT || "main";
}

/**
 * Get tenant context from request
 */
export function getTenantContext(req: NextRequest): TenantContext {
  const hostname = req.headers.get("host") || "localhost";
  const tenantId = extractTenantId(hostname);
  
  // Check header override (for API testing)
  const headerTenant = req.headers.get("x-tenant-id");
  if (headerTenant && process.env.ALLOW_HEADER_TENANT_OVERRIDE === "true") {
    return getTenantById(headerTenant);
  }
  
  return getTenantById(tenantId);
}

/**
 * Get tenant by ID
 */
export function getTenantById(tenantId: string): TenantContext {
  const tenant = TENANT_REGISTRY[tenantId];
  
  if (tenant) {
    return tenant;
  }
  
  // Return a default invalid tenant if not found
  return {
    id: tenantId,
    name: "Unknown Tenant",
    tier: "free",
    settings: {
      maxRequestsPerMinute: 10,
      maxAiTokensPerDay: 1000,
      features: [],
    },
    isValid: false,
  };
}

/**
 * Validate if a tenant exists and is active
 */
export function isValidTenant(tenantId: string): boolean {
  return TENANT_REGISTRY[tenantId]?.isValid || false;
}

/**
 * Get all tenants (for admin)
 */
export function getAllTenants(): TenantContext[] {
  return Object.values(TENANT_REGISTRY);
}

/**
 * Register a new tenant (for admin)
 */
export function registerTenant(
  tenantId: string,
  name: string,
  tier: TenantTier = "free",
  settings?: Partial<TenantSettings>
): TenantContext {
  if (TENANT_REGISTRY[tenantId]) {
    throw new Error(`Tenant ${tenantId} already exists`);
  }
  
  const newTenant: TenantContext = {
    id: tenantId,
    name,
    tier,
    settings: {
      maxRequestsPerMinute: settings?.maxRequestsPerMinute || 50,
      maxAiTokensPerDay: settings?.maxAiTokensPerDay || 20000,
      features: settings?.features || ["chat"],
      customDomain: settings?.customDomain,
    },
    isValid: true,
  };
  
  TENANT_REGISTRY[tenantId] = newTenant;
  return newTenant;
}

/**
 * Update tenant settings
 */
export function updateTenantSettings(
  tenantId: string,
  settings: Partial<TenantSettings>
): TenantContext {
  const tenant = TENANT_REGISTRY[tenantId];
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }
  
  tenant.settings = {
    ...tenant.settings,
    ...settings,
  };
  
  return tenant;
}

/**
 * Check if a tenant has access to a feature
 */
export function hasFeature(tenantId: string, feature: string): boolean {
  const tenant = TENANT_REGISTRY[tenantId];
  if (!tenant) return false;
  
  return tenant.settings.features.includes(feature);
}

/**
 * Get tenant quota information
 */
export function getTenantQuota(tenantId: string): {
  requestsPerMinute: number;
  aiTokensPerDay: number;
  features: string[];
} {
  const tenant = TENANT_REGISTRY[tenantId];
  if (!tenant) {
    return { requestsPerMinute: 10, aiTokensPerDay: 1000, features: [] };
  }
  
  return {
    requestsPerMinute: tenant.settings.maxRequestsPerMinute,
    aiTokensPerDay: tenant.settings.maxAiTokensPerDay,
    features: tenant.settings.features,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request Context Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tenant ID from request (lightweight version)
 */
export function getTenantIdFromRequest(req: NextRequest): string {
  // Check header first (set by Nginx)
  const headerTenant = req.headers.get("x-tenant-id");
  if (headerTenant) {
    return headerTenant;
  }
  
  // Extract from hostname
  const hostname = req.headers.get("host") || "localhost";
  return extractTenantId(hostname);
}

/**
 * Create request context for security logging
 */
export function createRequestContext(req: NextRequest): {
  tenantId: string;
  ip: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
} {
  return {
    tenantId: getTenantIdFromRequest(req),
    ip: getClientIP(req),
    path: new URL(req.url).pathname,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    timestamp: Date.now(),
  };
}

/**
 * Get client IP from request
 */
function getClientIP(req: NextRequest): string {
  // Prefer x-real-ip set by Nginx
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  // Fall back to x-forwarded-for
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  return "unknown";
}
