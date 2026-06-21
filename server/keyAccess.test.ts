import { describe, expect, it } from "vitest";
import { toMaskedKeyRecord, toSafeEditAuditDetails } from "./keyAccess";

describe("key access redaction", () => {
  it("removes full key material from list records", () => {
    const result = toMaskedKeyRecord({
      id: 1,
      provider: "OpenAI",
      keyMasked: "sk-a...xyz",
      keyValue: "sk-actual-secret-value",
      validity: "valid",
      lastCheckedAt: "2026-06-21T14:00:00.000Z",
      usageCount: 0,
    });

    expect(result).not.toHaveProperty("keyValue");
    expect(JSON.stringify(result)).not.toContain("sk-actual-secret-value");
  });

  it("records edit intent without serializing the replacement key", () => {
    const result = toSafeEditAuditDetails({
      keyValue: "replacement-secret",
      validity: "valid",
    });
    expect(result).toEqual({
      keyValueChanged: true,
      validityChanged: true,
      validity: "valid",
    });
    expect(JSON.stringify(result)).not.toContain("replacement-secret");
  });
});
