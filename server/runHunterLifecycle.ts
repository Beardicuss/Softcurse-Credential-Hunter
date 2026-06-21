import { fileURLToPath } from "node:url";
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
} = {}) {
  const apply = Boolean(options.apply);
  const keys = await getAllKeys();
  const plan = planCandidateLifecycle(
    keys,
    options.now || new Date(),
    options.policy || lifecyclePolicyFromEnv()
  );

  if (apply) {
    for (const key of plan.revalidate) {
      if (!key.revalidationSuggested) {
        await updateKeyById(key.id, { revalidationSuggested: true, freshness: "stale" });
      }
    }
    await deleteApiKeysByIds(plan.deleteCandidates.map(key => key.id));
    for (const provider of plan.affectedProviders) await updateProviderStats(provider);
  }

  await logAuditEvent(apply ? "lifecycle_applied" : "lifecycle_dry_run", undefined, undefined, {
    ...plan.totals,
    providers: plan.affectedProviders,
    deletedIds: apply ? plan.deleteCandidates.map(key => key.id) : [],
  });

  return { ...plan, applied: apply };
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCandidateLifecycle({ apply: process.env.HUNTER_RETENTION_APPLY === "true" })
    .then(result => {
      console.log(`[Hunter Lifecycle] ${result.applied ? "Applied" : "Dry run"}: ${result.totals.revalidate} revalidation, ${result.totals.deleteCandidates} deletion candidate(s).`);
    })
    .catch(error => {
      console.error("[Hunter Lifecycle] Failed:", error);
      process.exitCode = 1;
    });
}