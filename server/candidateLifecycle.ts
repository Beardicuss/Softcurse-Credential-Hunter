export interface LifecycleKey {
  id: number;
  provider: string;
  validity: "valid" | "invalid" | "unknown" | "rate_limited";
  lastCheckedAt: Date | string | null;
  lastUsedAt?: Date | string | null;
  discoveredAt?: Date | string | null;
  revalidationSuggested?: boolean | null;
}

export interface LifecyclePolicy {
  revalidateAfterDays: number;
  invalidRetentionDays: number;
  unknownRetentionDays: number;
}

export const DEFAULT_LIFECYCLE_POLICY: LifecyclePolicy = {
  revalidateAfterDays: 14,
  invalidRetentionDays: 90,
  unknownRetentionDays: 180,
};

export function planCandidateLifecycle(
  keys: LifecycleKey[],
  now = new Date(),
  policy: LifecyclePolicy = DEFAULT_LIFECYCLE_POLICY
) {
  const revalidate: LifecycleKey[] = [];
  const deleteCandidates: LifecycleKey[] = [];
  const retained: LifecycleKey[] = [];

  for (const key of keys) {
    const ageDays = daysSince(referenceDate(key), now);
    const deleteAfter = key.validity === "invalid"
      ? policy.invalidRetentionDays
      : key.validity === "unknown"
        ? policy.unknownRetentionDays
        : Number.POSITIVE_INFINITY;

    if (ageDays >= deleteAfter && !key.lastUsedAt) {
      deleteCandidates.push(key);
      continue;
    }
    if (ageDays >= policy.revalidateAfterDays && key.validity !== "invalid") {
      revalidate.push(key);
    }
    retained.push(key);
  }

  return {
    generatedAt: now.toISOString(),
    policy,
    totals: {
      inspected: keys.length,
      retained: retained.length,
      revalidate: revalidate.length,
      deleteCandidates: deleteCandidates.length,
    },
    retained,
    revalidate,
    deleteCandidates,
    affectedProviders: Array.from(new Set([...revalidate, ...deleteCandidates].map(key => key.provider))).sort(),
  };
}

function referenceDate(key: LifecycleKey): Date | null {
  return toDate(key.lastCheckedAt) || toDate(key.discoveredAt);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(date: Date | null, now: Date): number {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}
export function buildLifecyclePreview(
  plan: ReturnType<typeof planCandidateLifecycle>,
  applyConfigured: boolean
) {
  return {
    generatedAt: plan.generatedAt,
    mode: applyConfigured ? "apply" as const : "dry-run" as const,
    policy: plan.policy,
    totals: plan.totals,
    affectedProviders: plan.affectedProviders,
    revalidate: plan.revalidate.map(toSafeLifecycleRecord),
    deleteCandidates: plan.deleteCandidates.map(toSafeLifecycleRecord),
  };
}

function toSafeLifecycleRecord(key: LifecycleKey & { keyMasked?: string | null }) {
  return {
    id: key.id,
    provider: key.provider,
    keyMasked: key.keyMasked || "***",
    validity: key.validity,
    lastCheckedAt: key.lastCheckedAt,
    discoveredAt: key.discoveredAt || null,
  };
}