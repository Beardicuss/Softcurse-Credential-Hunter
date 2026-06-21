export interface HunterOperationalKey {
  id: number;
  provider: string;
  keyMasked: string;
  validity: string;
  source?: string | null;
  freshness?: string | null;
  validationStatus?: string | null;
  validationReason?: string | null;
  validationTier?: string | null;
  revalidationSuggested?: boolean | null;
  lastCheckedAt: Date | string | null;
}

export function buildHunterOperations(keys: HunterOperationalKey[]) {
  const safeKeys = keys.map(toOperationalRecord);
  const validationQueue = safeKeys
    .filter(
      key =>
        key.revalidationSuggested ||
        key.validity === "unknown" ||
        key.validity === "rate_limited"
    )
    .sort(queueSort);
  const staleKeys = safeKeys
    .filter(key => key.freshness === "stale")
    .sort(queueSort);
  const unknownProviders = safeKeys
    .filter(key => isUnknownProvider(key))
    .sort(queueSort);

  const sourceMap = new Map<string, typeof safeKeys>();
  for (const key of safeKeys) {
    const source = key.source || "unknown-source";
    const records = sourceMap.get(source) || [];
    records.push(key);
    sourceMap.set(source, records);
  }

  const sources = Array.from(sourceMap, ([source, records]) => ({
    source,
    total: records.length,
    valid: records.filter(key => key.validity === "valid").length,
    invalid: records.filter(key => key.validity === "invalid").length,
    unknown: records.filter(
      key => key.validity !== "valid" && key.validity !== "invalid"
    ).length,
    stale: records.filter(key => key.freshness === "stale").length,
    revalidationSuggested: records.filter(key => key.revalidationSuggested)
      .length,
  })).sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));

  return {
    totals: {
      sources: sources.length,
      validationQueue: validationQueue.length,
      stale: staleKeys.length,
      unknownProviders: unknownProviders.length,
    },
    sources,
    validationQueue,
    staleKeys,
    unknownProviders,
  };
}

function toOperationalRecord(key: HunterOperationalKey) {
  return {
    id: key.id,
    provider: key.provider,
    keyMasked: key.keyMasked,
    validity: key.validity,
    source: key.source || "unknown-source",
    freshness: key.freshness || "unknown",
    validationStatus: key.validationStatus || "unknown",
    validationReason: key.validationReason || null,
    validationTier: key.validationTier || "unknown",
    revalidationSuggested: Boolean(key.revalidationSuggested),
    lastCheckedAt: key.lastCheckedAt,
  };
}

function isUnknownProvider(key: ReturnType<typeof toOperationalRecord>) {
  const provider = key.provider.toLowerCase();
  return (
    provider.includes("unknown") ||
    provider.includes("generic") ||
    key.validationStatus === "unsupported_probe"
  );
}

function queueSort(
  a: ReturnType<typeof toOperationalRecord>,
  b: ReturnType<typeof toOperationalRecord>
) {
  if (a.revalidationSuggested !== b.revalidationSuggested)
    return a.revalidationSuggested ? -1 : 1;
  return a.provider.localeCompare(b.provider) || a.id - b.id;
}
