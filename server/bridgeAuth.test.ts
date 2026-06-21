import { describe, expect, it } from "vitest";
import { authorizeBridgeToken, secureTokenEqual } from "./bridgeAuth";

describe("HEX bridge authorization", () => {
  it("accepts exact bearer and alternate tokens", async () => {
    await expect(authorizeBridgeToken("secret", "Bearer secret")).resolves.toBe(
      true
    );
    await expect(
      authorizeBridgeToken("secret", undefined, "secret")
    ).resolves.toBe(true);
  });

  it("rejects missing, malformed, and partial tokens", async () => {
    await expect(authorizeBridgeToken("", "Bearer secret")).resolves.toBe(
      false
    );
    await expect(authorizeBridgeToken("secret", "secret")).resolves.toBe(false);
    await expect(authorizeBridgeToken("secret", "Bearer sec")).resolves.toBe(
      false
    );
    await expect(secureTokenEqual("secret-extra", "secret")).resolves.toBe(
      false
    );
  });
});
