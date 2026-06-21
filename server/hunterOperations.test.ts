import { describe, expect, it } from "vitest";
import { buildHunterOperations } from "./hunterOperations";

describe("buildHunterOperations", () => {
  it("builds redacted source and review queues", () => {
    const operations = buildHunterOperations([
      {
        id: 1,
        provider: "OpenAI",
        keyMasked: "sk...1",
        validity: "valid",
        source: "github",
        freshness: "fresh",
        validationStatus: "valid",
        validationTier: "high",
        revalidationSuggested: false,
        lastCheckedAt: null,
      },
      {
        id: 2,
        provider: "OpenAI",
        keyMasked: "sk...2",
        validity: "unknown",
        source: "github",
        freshness: "stale",
        validationStatus: "ready_for_probe",
        validationTier: "medium",
        revalidationSuggested: true,
        lastCheckedAt: null,
      },
      {
        id: 3,
        provider: "Generic Secret",
        keyMasked: "ge...3",
        validity: "unknown",
        source: "grayhat",
        freshness: "warm",
        validationStatus: "unsupported_probe",
        validationTier: "low",
        revalidationSuggested: false,
        lastCheckedAt: null,
      },
    ]);

    expect(operations.totals).toEqual({
      sources: 2,
      validationQueue: 2,
      stale: 1,
      unknownProviders: 1,
    });
    expect(operations.sources[0]).toMatchObject({
      source: "github",
      total: 2,
      valid: 1,
      stale: 1,
    });
    expect(operations.validationQueue[0].id).toBe(2);
    expect(JSON.stringify(operations)).not.toContain("keyValue");
  });
});
