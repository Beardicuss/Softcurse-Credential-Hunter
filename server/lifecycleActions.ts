export type LifecycleAction = "schedule_revalidation" | "cleanup";

export function authorizeLifecycleAction(
  action: LifecycleAction,
  confirmation: string,
  cleanupEnabled: boolean
) {
  if (action === "schedule_revalidation") {
    if (confirmation !== "SCHEDULE REVALIDATION") {
      return { allowed: false as const, reason: "confirmation_mismatch" as const };
    }
    return { allowed: true as const };
  }
  if (!cleanupEnabled) {
    return { allowed: false as const, reason: "cleanup_disabled" as const };
  }
  if (confirmation !== "DELETE STALE CANDIDATES") {
    return { allowed: false as const, reason: "confirmation_mismatch" as const };
  }
  return { allowed: true as const };
}
