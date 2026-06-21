import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { calculateShannonEntropy, createDiffKeyExtractor } = require("../scripts/hunter/core/diff-key-extractor.cjs");

describe("Hunter diff key extractor", () => {
  it("calculates entropy deterministically", () => {
    expect(calculateShannonEntropy("aaaa")).toBe(0);
    expect(calculateShannonEntropy("abcd")).toBe(2);
    expect(calculateShannonEntropy("")).toBe(0);
  });

  it("extracts secrets only from added diff lines and preserves context", () => {
    const scoreRecord = vi.fn(() => 0.88);
    const extract = createDiffKeyExtractor({
      keyPatterns: [{ provider: "Example", re: /EXAMPLE_KEY=([A-Za-z0-9]+)/g }],
      falsePositivePatterns: [],
      minimumEntropy: 1,
      scoreRecord,
      now: () => "2026-06-21T00:00:00.000Z",
    });
    const records = extract("-EXAMPLE_KEY=oldvalue\n+EXAMPLE_KEY=aB3dE5fG7h\n+++ b/file", {
      sourceUrl: "https://example.test/commit",
      query: "EXAMPLE_KEY",
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provider: "Example",
      value: "aB3dE5fG7h",
      line: 2,
      source: "github",
      confidence: 0.88,
      evidence: ["https://example.test/commit"],
    });
    expect(scoreRecord).toHaveBeenCalledOnce();
  });

  it("filters false positives and low-entropy matches", () => {
    const extract = createDiffKeyExtractor({
      keyPatterns: [{ provider: "Example", re: /KEY=([A-Za-z0-9]+)/g }],
      falsePositivePatterns: [/placeholder/i],
      minimumEntropy: 2,
    });
    expect(extract("+KEY=placeholder\n+KEY=aaaaaaaaaaaa")).toEqual([]);
  });
});
