import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloudflare Pages configuration", () => {
  it("enables Node compatibility for Pages Functions", () => {
    const configPath = path.join(process.cwd(), "wrangler.jsonc");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(config.pages_build_output_dir).toBe("./dist");
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(Date.parse(config.compatibility_date)).not.toBeNaN();
  });

  it("keeps Worker-imported modules free of CLI URL detection", () => {
    for (const modulePath of [
      "server/runHunterLifecycle.ts",
      "server/credentialHunterIntegration.ts",
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), modulePath), "utf8");
      expect(source).not.toContain("fileURLToPath(import.meta.url)");
      expect(source).not.toContain("process.argv[1]");
    }
  });

  it("does not ship the obsolete infinite-loop SPA redirect", () => {
    expect(fs.existsSync(path.join(process.cwd(), "client", "public", "_redirects"))).toBe(false);
  });
});
