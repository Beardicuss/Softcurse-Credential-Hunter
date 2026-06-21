import { eq, sql, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tidb-serverless";
import { connect } from "@tidbcloud/serverless";
import { InsertUser, users, apiKeys, auditLogs, providerStats } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let client: any = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  const dbUrl = ENV.databaseUrl;
  if (!_db && dbUrl) {
    try {
      if (!client) {
        client = connect({ url: dbUrl });
      }
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── API Key Management ───────────────────────────────────────────────────────

export async function getValidKeysByProvider(provider: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.provider, provider), eq(apiKeys.validity, "valid")));
}

export async function getAllValidKeys() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys).where(eq(apiKeys.validity, "valid"));
}

export async function getAllKeys() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys);
}
export async function getKeysByProvider(provider: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys).where(eq(apiKeys.provider, provider));
}

export interface ApiKeyMetadata {
  confidence?: number | null;
  matchStrength?: string | null;
  validationTier?: string | null;
  validationStatus?: string | null;
  validationReason?: string | null;
  source?: string | null;
  evidenceUrl?: string | null;
  discoveredAt?: Date | null;
  lastValidatedAt?: Date | null;
  freshness?: string | null;
  revalidationSuggested?: boolean;
}
export async function upsertApiKey(
  provider: string,
  keyValue: string,
  validity: "valid" | "invalid" | "unknown" | "rate_limited",
  metadata: ApiKeyMetadata = {}
) {
  const db = await getDb();
  if (!db) return null;

  const masked = maskApiKey(keyValue);
  const existing = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyValue, keyValue))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(apiKeys)
      .set({ validity, lastCheckedAt: new Date(), ...metadata })
      .where(eq(apiKeys.keyValue, keyValue));
    return existing[0];
  }

  const result = await db.insert(apiKeys).values({
    provider,
    keyValue,
    keyMasked: masked,
    validity,
    lastCheckedAt: new Date(),
    ...metadata,
  });
  return result;
}

export async function updateKeyById(
  id: number,
  updates: Partial<typeof apiKeys.$inferInsert>
) {
  const db = await getDb();
  if (!db) return null;

  if (updates.keyValue) {
    updates.keyMasked = maskApiKey(updates.keyValue);
  }

  await db.update(apiKeys).set(updates).where(eq(apiKeys.id, id));

  // Return updated key
  const updated = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  if (updated.length > 0) {
    await updateProviderStats(updated[0].provider);
  }
  return updated;
}

export async function updateProviderStats(provider: string) {
  const db = await getDb();
  if (!db) return null;

  const validCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiKeys)
    .where(and(eq(apiKeys.provider, provider), eq(apiKeys.validity, "valid")));

  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiKeys)
    .where(eq(apiKeys.provider, provider));

  const existing = await db
    .select()
    .from(providerStats)
    .where(eq(providerStats.provider, provider))
    .limit(1);

  const validNum = (validCount[0]?.count as number) || 0;
  const totalNum = (totalCount[0]?.count as number) || 0;

  if (existing.length > 0) {
    await db
      .update(providerStats)
      .set({
        validKeyCount: validNum,
        totalKeyCount: totalNum,
        lastRefreshAt: new Date(),
      })
      .where(eq(providerStats.provider, provider));
  } else {
    await db.insert(providerStats).values({
      provider,
      validKeyCount: validNum,
      totalKeyCount: totalNum,
      lastRefreshAt: new Date(),
    });
  }
}

export async function logAuditEvent(
  eventType: string,
  provider?: string,
  keyId?: number,
  details?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(auditLogs).values({
    eventType,
    provider,
    keyId,
    details: details ? JSON.stringify(details) : null,
  });
}

export async function getAuditLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

export async function getProviderStats(provider: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(providerStats)
    .where(eq(providerStats.provider, provider));
  return result.length > 0 ? result[0] : null;
}

export async function getAllProviderStats() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(providerStats);
}

// TODO: add feature queries here as your schema grows.
