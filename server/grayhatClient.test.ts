import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const https = require("node:https");
const { fetchGrayhatSearch } = require("../scripts/hunter/sources/grayhat-client.cjs");

describe("GrayHat API client", () => {
  it("uses the v2 files endpoint and access_token authentication", async () => {
    const originalRequest = https.request;
    let captured: any;
    https.request = (options: any, callback: (response: any) => void) => {
      captured = options;
      const response = new (require("node:events").EventEmitter)();
      response.statusCode = 200;
      response.headers = {};
      const request = new (require("node:events").EventEmitter)();
      request.end = () => {
        callback(response);
        response.emit("data", "{}");
        response.emit("end");
      };
      request.destroy = () => undefined;
      return request;
    };

    try {
      await fetchGrayhatSearch(
        { keyword: "fixture", extensionQuery: "env,json" },
        { token: "fixture-token", timeoutMs: 1000 },
      );
    } finally {
      https.request = originalRequest;
    }

    expect(captured.path).toContain("/api/v2/files?");
    expect(captured.path).toContain("keywords=fixture");
    expect(captured.path).toContain("access_token=fixture-token");
    expect(captured.headers.authorization).toBe("Bearer fixture-token");
  });
});
