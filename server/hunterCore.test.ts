import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  verifyHunterOutputPayload,
} = require("../scripts/hunter/core/output-contract.cjs");
const { dedupeRecords } = require("../scripts/hunter/core/dedupe.cjs");
const { scoreSourceRecord } = require("../scripts/hunter/core/scoring.cjs");
const {
  assessValidationCandidate,
} = require("../scripts/hunter/core/validation-stages.cjs");
const {
  collectSources,
  mergeSourceErrors,
  mergeSourceSummaries,
} = require("../scripts/hunter/core/source-orchestrator.cjs");
const {
  getHunterSourceConfig,
} = require("../scripts/hunter/core/source-config.cjs");

describe("Hunter core pipeline", () => {
  it("deduplicates records while preserving stronger evidence and confidence", () => {
    const records = dedupeRecords([
      {
        fingerprint: "same-key",
        provider: "Generic Secret",
        confidence: 0.4,
        entropy: 3.9,
        matchStrength: "generic-hint",
        evidence: ["source-a"],
      },
      {
        fingerprint: "same-key",
        provider: "OpenAI",
        confidence: 0.9,
        entropy: 4.8,
        matchStrength: "known-pattern",
        evidence: ["source-b"],
      },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provider: "OpenAI",
      confidence: 0.9,
      entropy: 4.8,
      matchStrength: "known-pattern",
      evidence: ["source-a", "source-b"],
    });
  });

  it("scores strong known-provider evidence above generic hints", () => {
    const strong = scoreSourceRecord({
      provider: "OpenAI",
      entropy: 4.9,
      source: "github",
      sourceType: "commit",
      matchStrength: "known-pattern",
      lineContent: "OPENAI_API_KEY=...",
      query: "OPENAI_API_KEY",
      sourceUrl: "https://example.test/commit",
      evidence: ["a", "b"],
    });
    const generic = scoreSourceRecord({
      provider: "Generic Secret",
      entropy: 3.6,
      source: "text",
      sourceType: "text",
      matchStrength: "generic-hint",
    });

    expect(strong).toBeGreaterThan(generic);
    expect(strong).toBeLessThanOrEqual(1);
  });

  it("only probes supported, formatted candidates", () => {
    expect(
      assessValidationCandidate({
        provider: "OpenAI",
        value: "sk-example-long-enough",
        confidence: 0.9,
        matchStrength: "known-pattern",
      })
    ).toMatchObject({
      validationStage: "probe",
      shouldProbe: true,
    });
    expect(
      assessValidationCandidate({
        provider: "Generic Secret",
        value: "short",
        confidence: 0.2,
        matchStrength: "generic-hint",
      })
    ).toMatchObject({
      validationStatus: "deferred_low_confidence",
      shouldProbe: false,
    });
    expect(
      assessValidationCandidate({ provider: "AWS", value: "AKIAEXAMPLE" })
    ).toMatchObject({
      validationStatus: "waiting_for_pair",
      shouldProbe: false,
    });
  });

  it("collects sources sequentially and merges summaries and errors", async () => {
    const order: string[] = [];
    const first = vi.fn(async () => {
      order.push("first");
      return {
        source: "first",
        summary: { OpenAI: { candidates: 2, valid: 1 } },
        errors: [{ error: "limited" }],
      };
    });
    const second = vi.fn(async () => {
      order.push("second");
      return {
        source: "second",
        summary: { OpenAI: { candidates: 3, invalid: 1 } },
        errors: [],
      };
    });

    const results = await collectSources([first, second]);
    expect(order).toEqual(["first", "second"]);
    expect(mergeSourceSummaries(results).OpenAI).toEqual({
      candidates: 5,
      confirmed: 0,
      valid: 1,
      invalid: 1,
      unknown: 0,
    });
    expect(mergeSourceErrors(results)).toEqual([{ error: "limited" }]);
  });

  it("parses source enablement, quotas, URLs, and safety controls", () => {
    const config = getHunterSourceConfig({
      GRAYHAT_ENABLED: "true",
      GRAYHAT_TOKEN: "token",
      GRAYHAT_MAX_QUERIES: "4",
      GRAYHAT_MIN_DELAY_MS: "750",
      WEBTEXT_ENABLED: "yes",
      WEBTEXT_URLS: "https://one.test/a,https://two.test/b",
      WEBTEXT_MAX_URLS: "2",
    });

    expect(config.grayhat).toMatchObject({
      enabled: true,
      token: "token",
      maxQueries: 4,
      safety: { minDelayMs: 750 },
    });
    expect(config.webtext).toMatchObject({
      enabled: true,
      maxUrls: 2,
      urls: ["https://one.test/a", "https://two.test/b"],
    });
  });
  it("accepts complete output and rejects malformed sync payloads", () => {
    const valid = verifyHunterOutputPayload({
      generated_at: "2026-06-21T14:00:00.000Z",
      total_candidates: 2,
      total_confirmed: 1,
      commits: [{ leaked_keys: [{ provider: "OpenAI", validity: "valid" }] }],
    });
    expect(valid).toMatchObject({
      valid: true,
      summary: { commits: 1, keys: 1, candidates: 2, confirmed: 1 },
    });

    const invalid = verifyHunterOutputPayload({
      generated_at: "not-a-date",
      commits: [{ leaked_keys: [{ validity: "broken" }] }],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain("generated_at_must_be_iso_date");
    expect(invalid.errors).toContain(
      "commits[0].leaked_keys[0].provider_required"
    );
    expect(invalid.errors).toContain(
      "commits[0].leaked_keys[0].validity_invalid"
    );
  });
});
