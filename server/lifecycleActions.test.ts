import { describe, expect, it } from "vitest";
import { authorizeLifecycleAction } from "./lifecycleActions";

describe("Hunter lifecycle action authorization", () => {
  it("allows scheduling only with the exact phrase", () => {
    expect(authorizeLifecycleAction("schedule_revalidation", "SCHEDULE REVALIDATION", false)).toEqual({ allowed: true });
    expect(authorizeLifecycleAction("schedule_revalidation", "schedule", false)).toMatchObject({ allowed: false, reason: "confirmation_mismatch" });
  });

  it("requires both server enablement and exact cleanup confirmation", () => {
    expect(authorizeLifecycleAction("cleanup", "DELETE STALE CANDIDATES", false)).toMatchObject({ allowed: false, reason: "cleanup_disabled" });
    expect(authorizeLifecycleAction("cleanup", "wrong", true)).toMatchObject({ allowed: false, reason: "confirmation_mismatch" });
    expect(authorizeLifecycleAction("cleanup", "DELETE STALE CANDIDATES", true)).toEqual({ allowed: true });
  });
});
