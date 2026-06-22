import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { syncCredentialHunterPayload } from "./credentialHunterIntegration";

const require = createRequire(import.meta.url);
const { collectSources, mergeSourceErrors, mergeSourceSummaries } = require("../scripts/hunter/core/source-orchestrator.cjs");
const { createSourceRecord } = require("../scripts/hunter/core/source-record.cjs");
const { dedupeRecords } = require("../scripts/hunter/core/dedupe.cjs");
const { processVerificationResults } = require("../scripts/hunter/core/validation-processor.cjs");
const { buildHunterOutput } = require("../scripts/hunter/core/output-writer.cjs");
const { verifyHunterOutputPayload } = require("../scripts/hunter/core/output-contract.cjs");

const SOURCES = [
  ["github", "OpenAI"],
  ["grayhat", "Anthropic"],
  ["gitlab", "Mistral"],
  ["gist", "Cohere"],
  ["webtext", "GitHub PAT"],
] as const;

function buildRecord(source: string, provider: string, index: number) {
  return createSourceRecord({
    provider,
    value: "fixture-only-secret-" + source + "-" + index,
    source,
    sourceType: "authorized-fixture",
    sourceUrl: "https://example.test/" + source + "/" + index,
    confidence: 0.92,
    entropy: 4.5,
    matchStrength: "known-pattern",
    discoveredAt: "2026-06-22T12:00:00.000Z",
    fingerprint: provider + "::fixture-" + index,
  });
}

async function runLimited(fn: (item: unknown) => Promise<unknown>, _limit: number, items: unknown[]) {
  return Promise.all(items.map(fn));
}

describe("authorized multi-source acceptance", () => {
  it("moves synthetic discoveries through collection, validation, contract, and sync", async () => {
    let transientAttempts = 0;
    const runners = SOURCES.map(([source, provider], index) => ({
      name: source,
      run: async () => {
        if (source === "gitlab" && transientAttempts++ === 0) {
          throw new Error("HTTP 503 temporary fixture failure");
        }
        return {
          source,
          extractedKeys: [buildRecord(source, provider, index)],
          summary: {
            [provider]: { candidates: 1, confirmed: 0, valid: 0, invalid: 0, unknown: 0 },
          },
          errors: [],
        };
      },
    }));

    const sourceResults = await collectSources(runners, {
      maxAttempts: 2,
      baseDelayMs: 0,
      sleep: async () => undefined,
    });

    expect(sourceResults).toHaveLength(5);
    expect(sourceResults.diagnostics).toHaveLength(5);
    expect(sourceResults.diagnostics.every((run: { status: string }) => run.status === "completed")).toBe(true);
    expect(sourceResults.diagnostics.find((run: { source: string }) => run.source === "gitlab").attempts).toBe(2);

    const records = dedupeRecords(sourceResults.flatMap((result: { extractedKeys: unknown[] }) => result.extractedKeys));
    expect(records).toHaveLength(5);

    const summary = mergeSourceSummaries(sourceResults);
    const verificationResults = records.map((record: { source: string; provider: string }, index: number) => ({
      commit: {
        sha: record.source + "-" + index,
        provider: record.provider,
        repo_owner: "authorized-fixture",
        repo_name: record.source,
        commit_url: "https://example.test/" + record.source,
        source: record.source,
      },
      keys: [record],
    }));

    const checkKeyValidity = vi.fn().mockResolvedValue("valid");
    const confirmed = await processVerificationResults({
      verificationResults,
      summary,
      generatedAt: "2026-06-22T12:05:00.000Z",
      checkKeyValidity,
      runLimited,
      logger: { log: vi.fn() },
    });
    expect(checkKeyValidity).toHaveBeenCalledTimes(5);

    const output = buildHunterOutput({
      generatedAt: "2026-06-22T12:05:00.000Z",
      totalCandidates: records.length,
      confirmed,
      summary,
      sourceRuns: sourceResults.diagnostics,
      errors: mergeSourceErrors(sourceResults),
    });
    expect(verifyHunterOutputPayload(output)).toMatchObject({
      valid: true,
      summary: { commits: 5, keys: 5, candidates: 5, confirmed: 5 },
    });

    const upsertApiKey = vi.fn().mockResolvedValue(undefined);
    const updateProviderStats = vi.fn().mockResolvedValue(undefined);
    const logAuditEvent = vi.fn().mockResolvedValue(undefined);
    const syncStats = await syncCredentialHunterPayload(output, {
      upsertApiKey,
      updateProviderStats,
      logAuditEvent,
    });

    expect(syncStats).toMatchObject({ imported: 5, valid: 5, invalid: 0 });
    expect(upsertApiKey).toHaveBeenCalledTimes(5);
    expect(updateProviderStats).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(sourceResults.diagnostics)).not.toContain("fixture-only-secret");
  });
});
