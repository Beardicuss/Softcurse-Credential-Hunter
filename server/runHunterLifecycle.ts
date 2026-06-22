import { cleanupExpiredAuditLogs } from "./runAuditRetention";
import {
  deleteApiKeysByIds,
  getAllKeys,
  logAuditEvent,
  updateKeyById,
  updateProviderStats,
} from "./db";
import {
  DEFAULT_LIFECYCLE_POLICY,
  planCandidateLifecycle,
  type LifecyclePolicy,
} from "./candidateLifecycle";

export async function runCandidateLifecycle(options: {
  apply?: boolean;
  now?: Date;
  policy?: LifecyclePolicy;
  action?: "all" | "schedule_revalidation" | "cleanup";
} = {}) {
  const apply = Boolean(options.apply);
  const action = options.action || "all";
  const keys = await getAllKeys();
  const plan = planCandidateLifecycle(
    keys,
    options.now || new Date(),
    options.policy || lifecyclePolicyFromEnv()
  );

  if (apply && (action === "all" || action === "schedule_revalidation")) {
    for (const key of plan.revalidate) {
      if (!key.revalidationSuggested) {
        await updateKeyById(key.id, { revalidationSuggested: true, freshness: "stale" });
      }
    }
  }
  if (apply && (action === "all" || action === "cleanup")) {
    await deleteApiKeysByIds(plan.deleteCandidates.map(key => key.id));
  }
  if (apply) {
    for (const provider of plan.affectedProviders) await updateProviderStats(provider);
  }

  const auditCleanup = await cleanupExpiredAuditLogs({
    apply: process.env.HUNTER_AUDIT_RETENTION_APPLY !== "false",
    now: options.now,
  });
  await logAuditEvent(apply ? `lifecycle_${action}_applied` : "lifecycle_dry_run", undefined, undefined, {
    ...plan.totals,
    providers: plan.affectedProviders,
    action,
    deletedIds: apply && (action === "all" || action === "cleanup") ? plan.deleteCandidates.map(key => key.id) : [],
  });

  return { ...plan, applied: apply, auditCleanup };
}

export function lifecyclePolicyFromEnv(): LifecyclePolicy {
  return {
    revalidateAfterDays: positiveInt(process.env.HUNTER_REVALIDATE_AFTER_DAYS, DEFAULT_LIFECYCLE_POLICY.revalidateAfterDays),
    invalidRetentionDays: positiveInt(process.env.HUNTER_INVALID_RETENTION_DAYS, DEFAULT_LIFECYCLE_POLICY.invalidRetentionDays),
    unknownRetentionDays: positiveInt(process.env.HUNTER_UNKNOWN_RETENTION_DAYS, DEFAULT_LIFECYCLE_POLICY.unknownRetentionDays),
  };
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
