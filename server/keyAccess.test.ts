import { describe, expect, it } from "vitest";
import {
  groupValidKeyRecords,
  toMaskedKeyRecord,
  toSafeEditAuditDetails,
} from "./keyAccess";

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
  it("groups only valid keys by provider without exposing values", () => {
    const base = { lastCheckedAt: "2026-06-21T14:00:00.000Z", usageCount: 0 };
    const groups = groupValidKeyRecords([
      {
        ...base,
        id: 1,
        provider: "Provider B",
        keyMasked: "b...1",
        keyValue: "secret-b1",
        validity: "valid",
      },
      {
        ...base,
        id: 2,
        provider: "Provider A",
        keyMasked: "a...1",
        keyValue: "secret-a1",
        validity: "valid",
      },
      {
        ...base,
        id: 3,
        provider: "Provider B",
        keyMasked: "b...2",
        keyValue: "secret-b2",
        validity: "valid",
      },
      {
        ...base,
        id: 4,
        provider: "Provider C",
        keyMasked: "c...1",
        keyValue: "secret-c1",
        validity: "invalid",
      },
    ]);

    expect(groups.map(group => [group.provider, group.count])).toEqual([
      ["Provider B", 2],
      ["Provider A", 1],
    ]);
    expect(JSON.stringify(groups)).not.toContain("secret-");
  });
});
