import { describe, expect, it, vi } from "vitest";
import { syncCredentialHunterPayload } from "./credentialHunterIntegration";

describe("credential hunter integration", () => {
  it("preserves unknown providers and discovery metadata during sync", async () => {
    const upsertApiKey = vi.fn().mockResolvedValue(undefined);
    const updateProviderStats = vi.fn().mockResolvedValue(undefined);
    const logAuditEvent = vi.fn().mockResolvedValue(undefined);

    const stats = await syncCredentialHunterPayload({
      generated_at: "2026-06-22T12:00:00.000Z",
      commits: [{
        source: "authorized-fixture",
        commit_url: "https://example.test/evidence/1",
        leaked_keys: [{
          provider: "Future Quantum API",
          value_full: "fixture-secret",
          validity: "valid",
          confidence: 0.91,
          validationTier: "high",
          freshness: "fresh",
          revalidationSuggested: false,
        }],
      }],
    }, { upsertApiKey, updateProviderStats, logAuditEvent });

    expect(upsertApiKey).toHaveBeenCalledWith(
      "Future Quantum API",
      "fixture-secret",
      "valid",
      expect.objectContaining({
        source: "authorized-fixture",
        evidenceUrl: "https://example.test/evidence/1",
        confidence: 0.91,
      }),
    );
    expect(updateProviderStats).toHaveBeenCalledWith("Future Quantum API");
    expect(stats).toMatchObject({
      imported: 1,
      valid: 1,
      providers: { "Future Quantum API": 1 },
    });
  });
});
