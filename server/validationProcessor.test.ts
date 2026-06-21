import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { buildCandidatePairs, shouldSuppressPairPart } = require("../scripts/hunter/core/candidate-pairing.cjs");
const { processVerificationResults } = require("../scripts/hunter/core/validation-processor.cjs");

const runLimited = async (fn: (item: any) => Promise<any>, _limit: number, items: any[]) => Promise.all(items.map(fn));

describe("Hunter pairing and validation processor", () => {
  it("builds AWS pairs and suppresses individual pair parts", () => {
    const keys = [
      { provider: "AWS", value: "AKIAEXAMPLE12345", entropy: 4, evidence: ["id"] },
      { provider: "AWS Secret", value: "SecretExampleValue123456", entropy: 4.5, evidence: ["secret"] },
    ];
    const result = buildCandidatePairs(keys, { source: "github", commit_url: "url" });
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toMatchObject({ provider: "AWS Pair", matchStrength: "paired-secret" });
    expect(shouldSuppressPairPart("AWS", result.active)).toBe(true);
    expect(shouldSuppressPairPart("AWS Pair", result.active)).toBe(false);
  });

  it("validates candidates, updates summaries, and projects masked output", async () => {
    const summary: Record<string, any> = {};
    const validator = vi.fn(async () => "valid");
    const result = await processVerificationResults({
      verificationResults: [{
        commit: { sha: "abcdef123", provider: "OpenAI", repo_owner: "owner", repo_name: "repo" },
        keys: [{
          provider: "OpenAI",
          value: "sk-example-secret-value-123456789",
          entropy: 4.5,
          confidence: 0.9,
          matchStrength: "known-pattern",
          validationTier: "high",
          discoveredAt: "2026-06-20T00:00:00.000Z",
        }],
      }],
      summary,
      generatedAt: "2026-06-21T00:00:00.000Z",
      checkKeyValidity: validator,
      runLimited,
      logger: { log: vi.fn() },
    });

    expect(result).toHaveLength(1);
    expect(result[0].leaked_keys[0]).toMatchObject({ provider: "OpenAI", validity: "valid" });
    expect(result[0].leaked_keys[0].value_masked).not.toBe("sk-example-secret-value-123456789");
    expect(summary.OpenAI).toMatchObject({ confirmed: 1, valid: 1 });
    expect(validator).toHaveBeenCalledOnce();
  });
});
