import {
  deleteAuditLogsByIds,
  getAuditRetentionRecords,
} from "./db";
import {
  DEFAULT_AUDIT_RETENTION_POLICY,
  planAuditRetention,
  type AuditRetentionPolicy,
} from "./auditRetention";

export async function cleanupExpiredAuditLogs(options: {
  apply?: boolean;
  now?: Date;
  policy?: AuditRetentionPolicy;
} = {}) {
  const policy = options.policy || auditRetentionPolicyFromEnv();
  const records = await getAuditRetentionRecords(Math.max(policy.batchSize * 5, 5000));
  const plan = planAuditRetention(records, options.now || new Date(), policy);
  const deleted = options.apply === false
    ? 0
    : await deleteAuditLogsByIds(plan.expiredIds);
  return { ...plan, applied: options.apply !== false, deleted };
}

export function auditRetentionPolicyFromEnv(): AuditRetentionPolicy {
  return {
    rateLimitDays: positiveInt(process.env.HUNTER_RATE_LIMIT_AUDIT_DAYS, DEFAULT_AUDIT_RETENTION_POLICY.rateLimitDays),
    securityAuditDays: positiveInt(process.env.HUNTER_SECURITY_AUDIT_DAYS, DEFAULT_AUDIT_RETENTION_POLICY.securityAuditDays),
    batchSize: positiveInt(process.env.HUNTER_AUDIT_CLEANUP_BATCH_SIZE, DEFAULT_AUDIT_RETENTION_POLICY.batchSize),
  };
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
