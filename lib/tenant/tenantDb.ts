/**
 * Tenant Database Isolation
 * 
 * Provides dynamic connection string management for multi-tenant architecture.
 * Currently uses a single database with tenant field filtering.
 * Ready to switch to database-per-tenant when needed.
 */

import { MongoClient, Db, Collection, Document, OptionalId } from "mongodb";

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const ISOLATION_MODE = process.env.TENANT_ISOLATION_MODE || "single";

const getBaseConnectionString = (): string => {
  return process.env.MONGODB_URI || "mongodb://localhost:27017/vulnerax";
};

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface TenantDatabaseConfig {
  tenantId: string;
  connectionString: string;
  databaseName: string;
  isIsolated: boolean;
}

export interface TenantDocument extends Document {
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Connection Pool Management
// ═══════════════════════════════════════════════════════════════════════════════

let globalClient: MongoClient | null = null;
const tenantClients = new Map<string, MongoClient>();

export async function getGlobalClient(): Promise<MongoClient> {
  if (!globalClient) {
    const uri = getBaseConnectionString();
    globalClient = new MongoClient(uri);
    await globalClient.connect();
    console.log("[TenantDB] Global MongoDB client connected");
  }
  return globalClient;
}

export async function getTenantClient(tenantId: string): Promise<MongoClient> {
  if (ISOLATION_MODE === "single") {
    return getGlobalClient();
  }
  
  if (ISOLATION_MODE === "database-per-tenant") {
    if (!tenantClients.has(tenantId)) {
      const config = buildTenantConnectionConfig(tenantId);
      const client = new MongoClient(config.connectionString);
      await client.connect();
      tenantClients.set(tenantId, client);
      console.log(`[TenantDB] Tenant-specific client connected for ${tenantId}`);
    }
    return tenantClients.get(tenantId)!;
  }
  
  throw new Error(`Unknown isolation mode: ${ISOLATION_MODE}`);
}

export function buildTenantConnectionConfig(tenantId: string): TenantDatabaseConfig {
  const baseUri = getBaseConnectionString();
  const url = new URL(baseUri);
  const baseDbName = url.pathname.replace(/^\//, "") || "vulnerax";
  
  if (ISOLATION_MODE === "single") {
    return {
      tenantId,
      connectionString: baseUri,
      databaseName: baseDbName,
      isIsolated: false,
    };
  }
  
  if (ISOLATION_MODE === "database-per-tenant") {
    const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const tenantDbName = `${baseDbName}_${sanitizedTenantId}`;
    
    const tenantUri = new URL(baseUri);
    tenantUri.pathname = `/${tenantDbName}`;
    
    return {
      tenantId,
      connectionString: tenantUri.toString(),
      databaseName: tenantDbName,
      isIsolated: true,
    };
  }
  
  throw new Error(`Unknown isolation mode: ${ISOLATION_MODE}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Database Access
// ═══════════════════════════════════════════════════════════════════════════════

export async function getTenantDatabase(tenantId: string): Promise<Db> {
  const client = await getTenantClient(tenantId);
  const config = buildTenantConnectionConfig(tenantId);
  return client.db(config.databaseName);
}

export async function getTenantCollection<T extends TenantDocument>(
  tenantId: string,
  collectionName: string
): Promise<Collection<T>> {
  const db = await getTenantDatabase(tenantId);
  return db.collection<T>(collectionName);
}

export function withTenantId<T extends Record<string, unknown>>(
  tenantId: string,
  doc: T
): T & { tenant_id: string; created_at: Date; updated_at: Date } {
  return {
    ...doc,
    tenant_id: tenantId,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

export function tenantFilter(tenantId: string): { tenant_id: string } {
  return { tenant_id: tenantId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tenant-Aware CRUD Operations
// ═══════════════════════════════════════════════════════════════════════════════

export async function insertWithTenant<T extends Record<string, unknown>>(
  tenantId: string,
  collectionName: string,
  doc: T
): Promise<T & { _id: unknown; tenant_id: string }> {
  const collection = await getTenantCollection(tenantId, collectionName);
  const docWithTenant = withTenantId(tenantId, doc);
  const result = await collection.insertOne(docWithTenant as OptionalId<TenantDocument>);
  return { ...docWithTenant, _id: result.insertedId };
}

// Use any to work around MongoDB type complexity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findByTenant(
  tenantId: string,
  collectionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: Record<string, any> = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const collection = await getTenantCollection<TenantDocument>(tenantId, collectionName);
  const tenantAwareFilter = { ...filter, tenant_id: tenantId };
  return collection.find(tenantAwareFilter).toArray();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findOneByTenant(
  tenantId: string,
  collectionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: Record<string, any> = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const collection = await getTenantCollection<TenantDocument>(tenantId, collectionName);
  const tenantAwareFilter = { ...filter, tenant_id: tenantId };
  return collection.findOne(tenantAwareFilter);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateByTenant(
  tenantId: string,
  collectionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: Record<string, any>
): Promise<number> {
  const collection = await getTenantCollection<TenantDocument>(tenantId, collectionName);
  const tenantAwareFilter = { ...filter, tenant_id: tenantId };
  
  const result = await collection.updateMany(tenantAwareFilter, {
    ...update,
    $set: {
      ...(update.$set || {}),
      updated_at: new Date(),
    },
  });
  
  return result.modifiedCount;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteByTenant(
  tenantId: string,
  collectionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: Record<string, any> = {}
): Promise<number> {
  const collection = await getTenantCollection<TenantDocument>(tenantId, collectionName);
  const tenantAwareFilter = { ...filter, tenant_id: tenantId };
  const result = await collection.deleteMany(tenantAwareFilter);
  return result.deletedCount || 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Operations (Cross-Tenant)
// ═══════════════════════════════════════════════════════════════════════════════

export async function findAcrossTenants(
  collectionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: Record<string, any> = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const client = await getGlobalClient();
  const db = client.db();
  const collection = db.collection<TenantDocument>(collectionName);
  return collection.find(filter).toArray();
}

export async function countByTenant(
  collectionName: string
): Promise<Record<string, number>> {
  const client = await getGlobalClient();
  const db = client.db();
  const collection = db.collection(collectionName);
  
  const pipeline = [
    { $group: { _id: "$tenant_id", count: { $sum: 1 } } },
  ];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await collection.aggregate(pipeline).toArray() as any[];
  const counts: Record<string, number> = {};
  
  for (const result of results) {
    counts[result._id as string] = result.count as number;
  }
  
  return counts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Connection Management
// ═══════════════════════════════════════════════════════════════════════════════

export async function closeAllConnections(): Promise<void> {
  if (globalClient) {
    await globalClient.close();
    globalClient = null;
    console.log("[TenantDB] Global client closed");
  }
  
  for (const [tenantId, client] of tenantClients) {
    await client.close();
    console.log(`[TenantDB] Client closed for tenant ${tenantId}`);
  }
  tenantClients.clear();
}

export function getConnectionStatus(): {
  mode: string;
  globalConnected: boolean;
  tenantConnections: string[];
} {
  return {
    mode: ISOLATION_MODE,
    globalConnected: globalClient !== null,
    tenantConnections: Array.from(tenantClients.keys()),
  };
}
