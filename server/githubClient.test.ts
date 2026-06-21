import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createGitHubClient, extractGitHubResult, isHtml } = require("../scripts/hunter/sources/github-client.cjs");

describe("Hunter GitHub client", () => {
  it("normalizes GitHub commit search results", () => {
    expect(extractGitHubResult({
      sha: "abc123",
      author_date: "2026-01-01T00:00:00Z",
      authors: [{ login: "user" }],
      repository: { repository: { owner_login: "owner", name: "repo" } },
    }, "OpenAI", "OPENAI_API_KEY")).toMatchObject({
      provider: "OpenAI",
      sha: "abc123",
      repo_owner: "owner",
      repo_name: "repo",
      commit_url: "https://github.com/owner/repo/commit/abc123",
    });
  });

  it("detects HTML responses case-insensitively", () => {
    expect(isHtml("  <!DOCTYPE html>")).toBe(true);
    expect(isHtml("<HTML><body></body></HTML>")).toBe(true);
    expect(isHtml('{"payload":{}}')).toBe(false);
  });

  it("retries rate-limited searches and parses the successful response", async () => {
    const httpGet = vi.fn()
      .mockResolvedValueOnce({ statusCode: 429, body: "limited" })
      .mockResolvedValueOnce({ statusCode: 200, body: JSON.stringify({ payload: { results: [{ sha: "sha1", repository: { repository: {} } }] } }) });
    const delay = vi.fn(async () => undefined);
    const client = createGitHubClient({ httpGet, delay, maxRetries: 1, retryDelayMs: 25, logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } });

    const result = await client.searchGitHub("OpenAI", "query");
    expect(result.error).toBeNull();
    expect(result.results).toHaveLength(1);
    expect(httpGet).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(25);
  });

  it("rejects HTML diff responses", async () => {
    const client = createGitHubClient({
      httpGet: vi.fn(async () => ({ statusCode: 200, body: "<html>blocked</html>" })),
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    await expect(client.fetchDiff("owner", "repo", "sha")).resolves.toBeNull();
  });
});
