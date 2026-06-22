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
  it("paginates within budget and skips checkpointed files", async () => {
    const responses = [
      {
        files: [
          { bucket: "bucket-a", path: "one.env", url: "https://example.test/one.env" },
          { bucket: "bucket-a", path: "two.env", url: "https://example.test/two.env" },
        ],
        next_page: 2,
      },
      {
        files: [
          { bucket: "bucket-a", path: "three.env", url: "https://example.test/three.env" },
        ],
        next_page: null,
      },
    ];
    const fetchSearch = vi.fn()
      .mockResolvedValueOnce({ statusCode: 200, body: JSON.stringify(responses[0]), headers: {} })
      .mockResolvedValueOnce({ statusCode: 200, body: JSON.stringify(responses[1]), headers: {} });

    const result = await collectGrayhatCandidates({
      config: {
        enabled: true,
        token: "fixture-token",
        apiPath: "/api/v2/files",
        maxQueries: 1,
        maxPagesPerQuery: 3,
        maxRequests: 3,
        pageSize: 2,
        fetchContent: false,
        safety: { minDelayMs: 0, cooldownOnErrorMs: 0 },
      },
      state: {
        queryOffset: 0,
        seenFingerprints: ["grayhat::azure::bucket-a::one.env"],
      },
      fetchSearch,
      logger: { log: vi.fn() },
    });

    expect(fetchSearch).toHaveBeenCalledTimes(2);
    expect(fetchSearch.mock.calls.map((call) => call[1].page)).toEqual([1, 2]);
    expect(result.unique).toHaveLength(2);
    expect(result.meta.health).toMatchObject({
      requests: 2,
      pages: 2,
      newFiles: 2,
      duplicatesSkipped: 1,
    });
    expect(result.meta.nextState.queryOffset).toBe(1);
  });
});
