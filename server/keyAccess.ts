export interface StoredKeyRecord {
  id: number;
  provider: string;
  keyMasked: string;
  keyValue: string;
  validity: string;
  lastCheckedAt: Date | string | null;
  usageCount: number;
}

export function toMaskedKeyRecord(key: StoredKeyRecord) {
  return {
    id: key.id,
    provider: key.provider,
    keyMasked: key.keyMasked,
    validity: key.validity,
    lastCheckedAt: key.lastCheckedAt,
    usageCount: key.usageCount,
  };
}

export function toSafeEditAuditDetails(input: {
  keyValue?: string;
  validity?: string;
}) {
  return {
    keyValueChanged: Boolean(input.keyValue),
    validityChanged: input.validity !== undefined,
    validity: input.validity,
  };
}
export function groupValidKeyRecords(keys: StoredKeyRecord[]) {
  const groups = new Map<string, ReturnType<typeof toMaskedKeyRecord>[]>();
  for (const key of keys) {
    if (key.validity !== "valid") continue;
    const records = groups.get(key.provider) || [];
    records.push(toMaskedKeyRecord(key));
    groups.set(key.provider, records);
  }
  return Array.from(groups, ([provider, records]) => ({
    provider,
    count: records.length,
    keys: records,
  })).sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
}
