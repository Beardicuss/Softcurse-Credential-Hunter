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
