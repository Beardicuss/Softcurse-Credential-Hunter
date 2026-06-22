export interface AuditRetentionRecord {
  id: number;
  eventType: string;
  createdAt: Date | string;
}

export interface AuditRetentionPolicy {
  rateLimitDays: number;
  securityAuditDays: number;
  batchSize: number;
}

export const DEFAULT_AUDIT_RETENTION_POLICY: AuditRetentionPolicy = {
  rateLimitDays: 7,
  securityAuditDays: 365,
  batchSize: 1000,
};

export function planAuditRetention(
  records: AuditRetentionRecord[],
  now = new Date(),
  policy: AuditRetentionPolicy = DEFAULT_AUDIT_RETENTION_POLICY
) {
  const expired = records
    .filter(record => {
      const createdAt = new Date(record.createdAt);
      if (Number.isNaN(createdAt.getTime())) return false;
      const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
      const retentionDays = record.eventType.startsWith("rate_limit:")
        ? policy.rateLimitDays
        : policy.securityAuditDays;
      return ageDays >= retentionDays;
    })
    .slice(0, policy.batchSize);

  return {
    expiredIds: expired.map(record => record.id),
    totals: {
      inspected: records.length,
      expired: expired.length,
      rateLimit: expired.filter(record => record.eventType.startsWith("rate_limit:")).length,
      security: expired.filter(record => !record.eventType.startsWith("rate_limit:")).length,
    },
    policy,
  };
}
