/**
 * Security Dashboard API - Stats Endpoint
 * 
 * GET /api/security
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, getAllTenants } from "@/lib/tenant/tenantContext";
import { getAttackStats } from "@/lib/security/attackDetector";
import { getTenantStats } from "@/lib/security/multiTenantRateLimiter";

function isAdminTenant(req: NextRequest): boolean {
  const tenantContext = getTenantContext(req);
  return tenantContext.id === "admin" || tenantContext.tier === "admin";
}

export async function GET(req: NextRequest) {
  if (!isAdminTenant(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenant");

  try {
    const stats = getAttackStats(tenantId || undefined);
    const tenantStats: Record<string, ReturnType<typeof getTenantStats>> = {};

    // Get stats for all tenants or specified tenant
    const tenants = tenantId ? [{ id: tenantId }] : getAllTenants();
    for (const tenant of tenants) {
      tenantStats[tenant.id] = getTenantStats(tenant.id);
    }

    return NextResponse.json({
      attacks: stats,
      rateLimits: tenantStats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Security API] Error getting stats:", error);
    return NextResponse.json(
      { error: "Failed to retrieve security stats" },
      { status: 500 }
    );
  }
}
