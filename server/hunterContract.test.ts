import { describe, expect, it } from "vitest";
import { buildHunterDatabaseSnapshot } from "./hunterContract";

describe("buildHunterDatabaseSnapshot", () => {
  it("preserves validation tiers, freshness, confidence, and valid-first provider ranking", () => {
    const snapshot = buildHunterDatabaseSnapshot(
      [
        {
          provider: "Provider A",
          validKeyCount: 1,
          totalKeyCount: 3,
          lastRefreshAt: "2026-06-21T12:00:00.000Z",
        },
        {
          provider: "Provider B",
          validKeyCount: 2,
          totalKeyCount: 2,
          lastRefreshAt: "2026-06-21T13:00:00.000Z",
        },
      ],
      [
        {
          provider: "Provider A",
          validity: "valid",
          confidence: 0.9,
          validationTier: "high",
          freshness: "fresh",
          revalidationSuggested: false,
          lastCheckedAt: "2026-06-21T12:00:00.000Z",
        },
        {
          provider: "Provider A",
          validity: "invalid",
          confidence: 0.3,
          validationTier: "low",
          freshness: "stale",
          revalidationSuggested: true,
          lastCheckedAt: "2026-06-21T11:00:00.000Z",
        },
        {
          provider: "Provider A",
          validity: "unknown",
          confidence: null,
          validationTier: "unknown",
          freshness: "warm",
          revalidationSuggested: false,
          lastCheckedAt: "2026-06-21T10:00:00.000Z",
        },
        {
          provider: "Provider B",
          validity: "valid",
          confidence: 0.8,
          validationTier: "high",
          freshness: "fresh",
          revalidationSuggested: false,
          lastCheckedAt: "2026-06-21T13:00:00.000Z",
        },
        {
          provider: "Provider B",
          validity: "valid",
          confidence: 0.6,
          validationTier: "medium",
          freshness: "warm",
          revalidationSuggested: false,
          lastCheckedAt: "2026-06-21T13:00:00.000Z",
        },
      ]
    );

    expect(snapshot.generatedAt).toBe("2026-06-21T13:00:00.000Z");
    expect(snapshot.validation).toEqual({
      valid: 3,
      invalid: 1,
      unknown: 1,
      byTier: { high: 2, medium: 1, low: 1, unknown: 1 },
    });
    expect(snapshot.freshness).toEqual({
      fresh: 2,
      warm: 2,
      stale: 1,
      revalidationSuggested: 1,
    });
    expect(snapshot.providers.map(provider => provider.provider)).toEqual([
      "Provider B",
      "Provider A",
    ]);
    expect(snapshot.providers[0]).toMatchObject({
      valid: 2,
      total: 2,
      avgConfidence: 0.7,
    });
  });

  it("includes providers discovered in keys before provider stats refresh", () => {
    const snapshot = buildHunterDatabaseSnapshot(
      [],
      [
        {
          provider: "New Provider",
          validity: "valid",
          validationTier: "medium",
          freshness: "fresh",
          lastCheckedAt: "2026-06-21T14:00:00.000Z",
        },
      ]
    );

    expect(snapshot.providers).toHaveLength(1);
    expect(snapshot.providers[0]).toMatchObject({
      provider: "New Provider",
      valid: 1,
      total: 1,
    });
    expect(snapshot.validation.byTier.medium).toBe(1);
  });
});
