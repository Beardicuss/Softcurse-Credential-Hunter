import { describe, expect, it, vi } from "vitest";
import { buildRateLimitScope, enforceSensitiveRateLimit } from "./sensitiveRateLimit";

describe("Hunter sensitive rate limiter", () => {
  it("uses a stable one-way actor scope without exposing the user id", () => {
    const scope = buildRateLimitScope("private-user-id", "reveal_key");
    expect(scope).toMatch(/^reveal_key:[a-f0-9]{16}$/);
    expect(scope).not.toContain("private-user-id");
  });

  it("passes the configured policy to persisted consumption", async () => {
    const consume = vi.fn(async () => true);
    const result = await enforceSensitiveRateLimit({ userId: "user", action: "validate_provider", consume });
    expect(result).toMatchObject({ allowed: true, limit: 5, windowMs: 600000 });
    expect(consume).toHaveBeenCalledWith(expect.stringMatching(/^validate_provider:/), 5, 600000);
  });

  it("reports rejected persisted consumption", async () => {
    const result = await enforceSensitiveRateLimit({ userId: "user", action: "lifecycle_action", consume: async () => false });
    expect(result.allowed).toBe(false);
  });
});
