import { z } from "zod";
import { normalizeProviderName } from "../shared/providerRegistry";

export const HunterKeySchema = z.object({
  provider: z.string(),
  value_masked: z.string().optional(),
  value_full: z.any().optional(),
  validity: z.string().default("unknown"),
  validationStatus: z.string().optional(),
  validationReason: z.string().nullable().optional(),
  entropy: z.number().optional(),
  confidence: z.number().optional(),
  matchStrength: z.string().optional(),
  validationTier: z.string().optional(),
  discoveredAt: z.string().optional(),
  lastValidatedAt: z.string().optional(),
  ageMs: z.number().optional(),
  validationAgeMs: z.number().optional(),
  freshness: z.string().optional(),
  revalidationSuggested: z.boolean().optional(),
});

export const HunterCommitSchema = z.object({
  provider: z.string().optional(),
  source: z.string().optional(),
  repo_owner: z.string().nullable().optional(),
  repo_name: z.string().nullable().optional(),
  commit_url: z.string().nullable().optional(),
  leaked_keys: z.array(HunterKeySchema).default([]),
});

export const HunterOutputSchema = z.object({
  generated_at: z.string(),
  total_candidates: z.number().optional(),
  total_confirmed: z.number().optional(),
  total_confirmed_commits: z.number().optional(),
  summary_by_provider: z.record(z.string(), z.object({
    candidates: z.number().default(0),
    confirmed: z.number().default(0),
    valid: z.number().default(0),
    invalid: z.number().default(0),
    unknown: z.number().default(0),
  })).default({}),
  failed_queries: z.array(z.any()).optional(),
  commits: z.array(HunterCommitSchema).default([]),
});

export type HunterOutput = z.infer<typeof HunterOutputSchema>;

export function buildHunterContractSnapshot(payload: HunterOutput) {
  const allKeys = payload.commits.flatMap((commit) => commit.leaked_keys || []);
  const providerMap = new Map<string, { provider: string; total: number; valid: number; invalid: number; unknown: number; rateLimited: number; fresh: number; warm: number; stale: number; revalidationSuggested: number; avgConfidence: number; _confidenceSum: number; }>();

  for (const key of allKeys) {
    const provider = normalizeProviderName(key.provider || "Unknown");
    const entry = providerMap.get(provider) || {
      provider,
      total: 0,
      valid: 0,
      invalid: 0,
      unknown: 0,
      rateLimited: 0,
      fresh: 0,
      warm: 0,
      stale: 0,
      revalidationSuggested: 0,
      avgConfidence: 0,
      _confidenceSum: 0,
    };

    entry.total += 1;
    if (key.validity === "valid") entry.valid += 1;
    else if (key.validity === "invalid") entry.invalid += 1;
    else if (key.validity === "rate_limited") entry.rateLimited += 1;
    else entry.unknown += 1;

    if (key.freshness === "fresh") entry.fresh += 1;
    else if (key.freshness === "warm") entry.warm += 1;
    else if (key.freshness === "stale") entry.stale += 1;

    if (key.revalidationSuggested) entry.revalidationSuggested += 1;
    if (typeof key.confidence === "number") {
      entry._confidenceSum += key.confidence;
    }

    providerMap.set(provider, entry);
  }

  const providers = Array.from(providerMap.values())
    .map((entry) => ({
      provider: entry.provider,
      total: entry.total,
      valid: entry.valid,
      invalid: entry.invalid,
      unknown: entry.unknown,
      rateLimited: entry.rateLimited,
      freshness: {
        fresh: entry.fresh,
        warm: entry.warm,
        stale: entry.stale,
      },
      revalidationSuggested: entry.revalidationSuggested,
      avgConfidence: entry.total > 0 ? Number((entry._confidenceSum / entry.total).toFixed(3)) : 0,
    }))
    .sort((a, b) => b.total - a.total || b.valid - a.valid || a.provider.localeCompare(b.provider));

  const freshness = {
    fresh: allKeys.filter((key) => key.freshness === "fresh").length,
    warm: allKeys.filter((key) => key.freshness === "warm").length,
    stale: allKeys.filter((key) => key.freshness === "stale").length,
    revalidationSuggested: allKeys.filter((key) => key.revalidationSuggested).length,
  };

  const validation = {
    valid: allKeys.filter((key) => key.validity === "valid").length,
    invalid: allKeys.filter((key) => key.validity === "invalid").length,
    unknown: allKeys.filter((key) => key.validity !== "valid" && key.validity !== "invalid").length,
    byTier: {
      high: allKeys.filter((key) => key.validationTier === "high").length,
      medium: allKeys.filter((key) => key.validationTier === "medium").length,
      low: allKeys.filter((key) => key.validationTier === "low").length,
      unknown: allKeys.filter((key) => !key.validationTier || key.validationTier === "unknown").length,
    },
  };

  return {
    contractVersion: "hunter.v1",
    generatedAt: payload.generated_at,
    totals: {
      candidates: payload.total_candidates || 0,
      confirmedKeys: allKeys.length,
      confirmedCommits: payload.total_confirmed_commits || payload.total_confirmed || payload.commits.length,
      providers: providers.length,
    },
    freshness,
    validation,
    providers,
    failedQueries: payload.failed_queries || [],
  };
}
export interface HunterFailedQuery {
  source?: string;
  query?: string;
  error?: string;
}

export interface HunterDatabaseKey {
  provider: string;
  validity: string;
  lastCheckedAt: Date | string | null;
}

export interface HunterDatabaseProviderStat {
  provider: string;
  validKeyCount: number;
  totalKeyCount: number;
  lastRefreshAt: Date | string | null;
}

export function buildHunterDatabaseSnapshot(
  stats: HunterDatabaseProviderStat[],
  keys: HunterDatabaseKey[],
) {
  const generatedAt = stats
    .map((item) => item.lastRefreshAt ? new Date(item.lastRefreshAt) : null)
    .filter((item): item is Date => item !== null && !Number.isNaN(item.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null;

  const providers = stats
    .map((stat) => {
      const providerKeys = keys.filter((key) => key.provider === stat.provider);
      const valid = providerKeys.filter((key) => key.validity === "valid").length;
      const invalid = providerKeys.filter((key) => key.validity === "invalid").length;
      const rateLimited = providerKeys.filter((key) => key.validity === "rate_limited").length;
      const unknown = Math.max(0, providerKeys.length - valid - invalid - rateLimited);

      return {
        provider: stat.provider,
        total: providerKeys.length || Number(stat.totalKeyCount || 0),
        valid: providerKeys.length ? valid : Number(stat.validKeyCount || 0),
        invalid,
        unknown,
        rateLimited,
        freshness: { fresh: 0, warm: 0, stale: 0 },
        revalidationSuggested: 0,
        avgConfidence: 0,
      };
    })
    .sort((a, b) => b.total - a.total || b.valid - a.valid || a.provider.localeCompare(b.provider));

  const valid = keys.filter((key) => key.validity === "valid").length;
  const invalid = keys.filter((key) => key.validity === "invalid").length;

  return {
    contractVersion: "hunter.v1",
    generatedAt,
    totals: {
      candidates: keys.length,
      confirmedKeys: keys.length,
      confirmedCommits: 0,
      providers: providers.length,
    },
    freshness: { fresh: 0, warm: 0, stale: 0, revalidationSuggested: 0 },
    validation: {
      valid,
      invalid,
      unknown: Math.max(0, keys.length - valid - invalid),
      byTier: { high: 0, medium: 0, low: 0, unknown: keys.length },
    },
    providers,
    failedQueries: [] as HunterFailedQuery[],
  };
}
