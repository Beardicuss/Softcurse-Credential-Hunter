import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { buildProviderProbe, createKeyValidator, statusResult } = require("../scripts/hunter/core/provider-validator.cjs");

describe("Hunter provider validator", () => {
  it("builds provider-specific probes without performing network calls", () => {
    expect(buildProviderProbe("OpenAI", "test-key", 1234)).toMatchObject({
      hostname: "api.openai.com",
      path: "/v1/models",
      timeoutMs: 1234,
      headers: { Authorization: "Bearer test-key" },
    });
    expect(buildProviderProbe("Unknown Provider", "value")).toBeNull();
  });

  it("maps provider status codes consistently", () => {
    expect(statusResult(200)).toBe("valid");
    expect(statusResult(429)).toBe("valid");
    expect(statusResult(401)).toBe("invalid");
    expect(statusResult(503)).toBe("unknown_status_503");
  });

  it("dispatches probes and preserves unsupported-provider statuses", async () => {
    const request = vi.fn(async () => ({ statusCode: 200, body: "{}" }));
    const validate = createKeyValidator({ request, timeoutMs: 500 });

    await expect(validate("Mistral", "key-value")).resolves.toBe("valid");
    await expect(validate("AWS", "id-only")).resolves.toBe("unknown_requires_secret");
    await expect(validate("Unknown Provider", "value")).resolves.toBe("unknown_provider");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ hostname: "api.mistral.ai" }));
  });

  it("validates paired Twilio credentials through the injected transport", async () => {
    const request = vi.fn(async () => ({ statusCode: 401, body: "{}" }));
    const validate = createKeyValidator({ request });
    await expect(validate("Twilio Pair", { sid: "AC123", token: "secret" })).resolves.toBe("invalid");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      hostname: "api.twilio.com",
      path: "/2010-04-01/Accounts/AC123.json",
    }));
  });
});
