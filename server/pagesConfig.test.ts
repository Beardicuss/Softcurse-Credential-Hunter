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

  it("does not ship the obsolete infinite-loop SPA redirect", () => {
    expect(fs.existsSync(path.join(process.cwd(), "client", "public", "_redirects"))).toBe(false);
  });
});
