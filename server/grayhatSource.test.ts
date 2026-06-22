import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { collectGrayhatCandidates } = require("../scripts/hunter/sources/grayhat-source.cjs");

describe("GrayHat source", () => {
  it("passes the configured v2 API path to the transport", async () => {
    const fetchSearch = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ files: [] }),
      headers: {},
    });

    const result = await collectGrayhatCandidates({
      config: {
        enabled: true,
        token: "fixture-token",
        apiPath: "/api/v2/files",
        maxQueries: 1,
        fetchContent: false,
        safety: { minDelayMs: 0, cooldownOnErrorMs: 0 },
      },
      fetchSearch,
      logger: { log: vi.fn() },
    });

    expect(fetchSearch).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ pathPrefix: "/api/v2/files" }),
    );
    expect(result.errors).toEqual([]);
  });
  it("stops immediately when GrayHat rejects authentication", async () => {
    const fetchSearch = vi.fn().mockResolvedValue({
      statusCode: 401,
      body: JSON.stringify({ error: "unauthorized" }),
      headers: {},
    });

    const result = await collectGrayhatCandidates({
      config: {
        enabled: true,
        token: "fixture-token",
        apiPath: "/api/v2/files",
        maxQueries: 6,
        fetchContent: false,
        safety: { minDelayMs: 0, cooldownOnErrorMs: 0, maxErrors: 6 },
      },
      fetchSearch,
      logger: { log: vi.fn() },
    });

    expect(fetchSearch).toHaveBeenCalledTimes(1);
    expect(result.errors[0].error).toBe("http_401");
  });
});
