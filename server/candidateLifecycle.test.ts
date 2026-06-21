import { describe, expect, it } from "vitest";
import { buildLifecyclePreview, planCandidateLifecycle } from "./candidateLifecycle";

describe("Hunter candidate lifecycle", () => {
  const now = new Date("2026-06-21T00:00:00.000Z");

  it("never deletes valid keys and schedules old keys for revalidation", () => {
    const plan = planCandidateLifecycle([
      { id: 1, provider: "OpenAI", validity: "valid", lastCheckedAt: "2026-01-01T00:00:00.000Z" },
    ], now);
    expect(plan.deleteCandidates).toEqual([]);
    expect(plan.revalidate.map(key => key.id)).toEqual([1]);
  });

  it("deletes only expired invalid/unknown keys that were never used", () => {
    const plan = planCandidateLifecycle([
      { id: 1, provider: "OpenAI", validity: "invalid", lastCheckedAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, provider: "Mistral", validity: "unknown", lastCheckedAt: "2025-01-01T00:00:00.000Z" },
      { id: 3, provider: "Cohere", validity: "invalid", lastCheckedAt: "2026-01-01T00:00:00.000Z", lastUsedAt: "2026-02-01T00:00:00.000Z" },
    ], now);
    expect(plan.deleteCandidates.map(key => key.id)).toEqual([1, 2]);
    expect(plan.retained.map(key => key.id)).toEqual([3]);
  });

  it("supports stricter policy overrides without mutating input", () => {
    const keys = [{ id: 4, provider: "Generic", validity: "unknown" as const, lastCheckedAt: "2026-06-01T00:00:00.000Z" }];
    const plan = planCandidateLifecycle(keys, now, { revalidateAfterDays: 7, invalidRetentionDays: 30, unknownRetentionDays: 10 });
    expect(plan.deleteCandidates.map(key => key.id)).toEqual([4]);
    expect(keys[0].validity).toBe("unknown");
  });
  it("builds a masked preview without exposing key values", () => {
    const plan = planCandidateLifecycle([
      {
        id: 9,
        provider: "OpenAI",
        validity: "invalid",
        keyValue: "sk-secret-must-not-leak",
        keyMasked: "sk-s...leak",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
      } as any,
    ], now);
    const preview = buildLifecyclePreview(plan, false);
    expect(preview.mode).toBe("dry-run");
    expect(preview.deleteCandidates[0]).toMatchObject({ id: 9, keyMasked: "sk-s...leak" });
    expect(JSON.stringify(preview)).not.toContain("must-not-leak");
  });
});