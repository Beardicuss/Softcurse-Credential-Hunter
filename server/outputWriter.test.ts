import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { buildHunterOutput, logHunterRunSummary, writeHunterOutput } = require("../scripts/hunter/core/output-writer.cjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("Hunter output writer", () => {
  it("builds the stable output shape", () => {
    const output = buildHunterOutput({
      generatedAt: "2026-06-21T12:00:00.000Z",
      totalCandidates: 4,
      confirmed: [{ leaked_keys: [] }],
      summary: { OpenAI: { candidates: 4 } },
      sourceRuns: [{ source: "github", status: "completed", attempts: 1 }],
      errors: [],
    });
    expect(output).toMatchObject({
      generated_at: "2026-06-21T12:00:00.000Z",
      total_candidates: 4,
      total_confirmed: 1,
      total_confirmed_commits: 1,
      source_runs: [{ source: "github" }],
      commits: [{ leaked_keys: [] }],
    });
    expect(output.failed_queries).toBeUndefined();
  });

  it("atomically replaces the snapshot without leaving temporary files", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hunter-output-"));
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, "nested", "leaked-api-keys.json");
    writeHunterOutput(outputPath, { generated_at: "first" });
    writeHunterOutput(outputPath, { generated_at: "second" });
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toEqual({ generated_at: "second" });
    expect(fs.readdirSync(path.dirname(outputPath))).toEqual(["leaked-api-keys.json"]);
  });

  it("logs summary counts without key material", () => {
    const logger = { log: vi.fn() };
    logHunterRunSummary({
      outputPath: "/safe/output.json",
      confirmedCount: 1,
      summary: { OpenAI: { candidates: 2, confirmed: 1, valid: 1, invalid: 0, unknown: 0 } },
      errors: [],
    }, logger);
    const message = logger.log.mock.calls.flat().join("\n");
    expect(message).toContain("OpenAI");
    expect(message).toContain("1 confirmed");
    expect(message).not.toContain("sk-");
  });
});
