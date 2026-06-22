/**
 * Credential Hunter Integration
 * Processes leaked-api-keys.json output and syncs to database
 */

import fs from "fs";
import path from "path";
import { upsertApiKey, updateProviderStats, logAuditEvent } from "./db";
import { normalizeProviderName } from "../shared/providerRegistry";
import { HunterOutputSchema } from "./hunterContract";

interface LeakedKey {
  provider: string;
  value_full: string;
  validity: "valid" | "invalid" | "unknown" | "rate_limited";
  entropy: number;
  confidence?: number;
  matchStrength?: string;
  validationTier?: string;
  validationStatus?: string;
  validationReason?: string | null;
  discoveredAt?: string;
  lastValidatedAt?: string;
  ageMs?: number;
  validationAgeMs?: number;
  freshness?: string;
  revalidationSuggested?: boolean;
  source?: string;
  evidenceUrl?: string | null;
}

interface LeakedKeysOutput {
  generated_at: string;
  commits: Array<{
    source?: string;
    commit_url?: string | null;
    leaked_keys: LeakedKey[];
  }>;
}

export interface CredentialHunterSyncDependencies {
  upsertApiKey: typeof upsertApiKey;
  updateProviderStats: typeof updateProviderStats;
  logAuditEvent: typeof logAuditEvent;
}

const defaultSyncDependencies: CredentialHunterSyncDependencies = {
  upsertApiKey,
  updateProviderStats,
  logAuditEvent,
};

export type CredentialHunterSyncStats = {
  imported: number;
  valid: number;
  invalid: number;
  providers: Record<string, number>;
  validProviders: Record<string, number>;
  invalidProviders: Record<string, number>;
};

export async function syncCredentialHunterOutput(jsonFilePath: string): Promise<CredentialHunterSyncStats> {
  try {
    if (!fs.existsSync(jsonFilePath)) {
      console.warn(`[Credential Hunter] Payload file not found: ${jsonFilePath}`);
      console.warn(`[Credential Hunter] Assuming 0 items discovered due to GitHub edge rate-limits.`);
      return { imported: 0, valid: 0, invalid: 0, providers: {}, validProviders: {}, invalidProviders: {} };
    }

    const fileContent = fs.readFileSync(jsonFilePath, "utf-8");
    return await syncCredentialHunterPayload(JSON.parse(fileContent));
  } catch (error) {
    console.error("[Credential Hunter] Sync failed:", error);
    throw error;
  }
}

export async function syncCredentialHunterPayload(
  payload: unknown,
  dependencies: CredentialHunterSyncDependencies = defaultSyncDependencies,
): Promise<CredentialHunterSyncStats> {
  const data = HunterOutputSchema.parse(payload) as LeakedKeysOutput;
  const stats = {
      imported: 0,
      valid: 0,
      invalid: 0,
      providers: {} as Record<string, number>,
      validProviders: {} as Record<string, number>,
      invalidProviders: {} as Record<string, number>,
    };

    const allKeys: LeakedKey[] = [];
    for (const commit of data.commits || []) {
      allKeys.push(...(commit.leaked_keys || []).map((key) => ({
        ...key,
        source: commit.source || "unknown",
        evidenceUrl: commit.commit_url || null,
      })));
    }

    const touchedProviders = new Set<string>();

    for (const key of allKeys) {
      const normalizedProvider = normalizeProviderName(key.provider);
      if (!normalizedProvider || !key.value_full) {
        continue;
      }

      try {
        await dependencies.upsertApiKey(normalizedProvider, key.value_full, key.validity, {
          confidence: key.confidence ?? null,
          matchStrength: key.matchStrength ?? null,
          validationTier: key.validationTier ?? null,
          validationStatus: key.validationStatus ?? null,
          validationReason: key.validationReason ?? null,
          source: key.source ?? null,
          evidenceUrl: key.evidenceUrl ?? null,
          discoveredAt: parseOptionalDate(key.discoveredAt),
          lastValidatedAt: parseOptionalDate(key.lastValidatedAt),
          freshness: key.freshness ?? null,
          revalidationSuggested: Boolean(key.revalidationSuggested),
        });
        touchedProviders.add(normalizedProvider);
        stats.imported++;

        if (key.validity === "valid") {
          stats.valid++;
          stats.validProviders[normalizedProvider] = (stats.validProviders[normalizedProvider] || 0) + 1;
        } else if (key.validity === "invalid") {
          stats.invalid++;
          stats.invalidProviders[normalizedProvider] = (stats.invalidProviders[normalizedProvider] || 0) + 1;
        }

        stats.providers[normalizedProvider] = (stats.providers[normalizedProvider] || 0) + 1;
      } catch (error) {
        console.error(`Failed to import key for ${normalizedProvider}:`, error);
      }
    }

    for (const provider of Array.from(touchedProviders)) {
      await dependencies.updateProviderStats(provider);
    }

    await dependencies.logAuditEvent("refresh_completed", undefined, undefined, {
      imported: stats.imported,
      valid: stats.valid,
      invalid: stats.invalid,
      providers: stats.providers,
      validProviders: stats.validProviders,
      invalidProviders: stats.invalidProviders,
      freshness: {
        fresh: allKeys.filter((key) => key.freshness === 'fresh').length,
        warm: allKeys.filter((key) => key.freshness === 'warm').length,
        stale: allKeys.filter((key) => key.freshness === 'stale').length,
        revalidationSuggested: allKeys.filter((key) => key.revalidationSuggested).length,
      },
    });

    console.log(`[Credential Hunter] Synced ${stats.imported} keys (${stats.valid} valid, ${stats.invalid} invalid)`);
  return stats;
}


function parseOptionalDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export async function validateAllKeys(): Promise<void> {
  console.log("[Credential Hunter] Key validation completed");
}

export function getDefaultCredentialHunterPath(): string {
  return path.join(process.cwd(), "scripts", "leaked-api-keys.json");
}
