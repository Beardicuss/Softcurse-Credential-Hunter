import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { verifyWorkflowContract } = require("../scripts/hunter/core/workflow-contract.cjs");

describe("workflow contract", () => {
  it("accepts the required deployment order", () => {
    const source = [
      'cron: "0 */6 * * *"',
      "run: pnpm install --frozen-lockfile",
      "run: pnpm hunt:check",
      "run: pnpm test",
      "run: pnpm check",
      "run: pnpm build",
      "run: pnpm pages:build",
      "run: pnpm workflow:verify",
      "run: pnpm db:migrate",
      "run: pnpm hunt",
      "run: pnpm hunt:verify",
      "run: pnpm hunt:sync",
      "run: pnpm hunt:lifecycle",
    ].join("\n");

    expect(verifyWorkflowContract(source)).toEqual({ valid: true, errors: [] });
  });

  it("rejects missing and reordered critical commands", () => {
    const result = verifyWorkflowContract([
      'cron: "0 */6 * * *"',
      "run: pnpm hunt",
      "run: pnpm install --frozen-lockfile",
    ].join("\n"));

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
