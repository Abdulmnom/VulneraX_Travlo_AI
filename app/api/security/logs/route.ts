/**
 * Security Dashboard API - Logs Endpoint
 * 
 * GET /api/security/logs
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant/tenantContext";
import { getAttackLogs, type AttackType } from "@/lib/security/attackDetector";

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

  try {
    const logs = getAttackLogs({
      tenantId: searchParams.get("tenant") || undefined,
      ip: searchParams.get("ip") || undefined,
      type: (searchParams.get("type") as AttackType) || undefined,
      since: searchParams.get("since")
        ? parseInt(searchParams.get("since")!, 10)
        : undefined,
      blocked: searchParams.has("blocked")
        ? searchParams.get("blocked") === "true"
        : undefined,
      limit: parseInt(searchParams.get("limit") || "100", 10),
    });

    return NextResponse.json({ logs, count: logs.length });
  } catch (error) {
    console.error("[Security API] Error getting logs:", error);
    return NextResponse.json(
      { error: "Failed to retrieve attack logs" },
      { status: 500 }
    );
  }
}
