import { describe, expect, it, vi } from "vitest";
import { dispatchHunterWorkflow } from "./githubWorkflowDispatch";

describe("GitHub workflow dispatch", () => {
  it("dispatches the configured workflow without exposing the token", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await dispatchHunterWorkflow({
      token: "fixture-secret-token",
      repository: "Beardicuss/Softcurse-Chess-Admin",
      workflow: "credential-hunter.yml",
      ref: "main",
    }, request);

    expect(result.accepted).toBe(true);
    expect(request).toHaveBeenCalledWith(
      "https://api.github.com/repos/Beardicuss/Softcurse-Chess-Admin/actions/workflows/credential-hunter.yml/dispatches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ref: "main" }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("fixture-secret-token");
  });

  it("returns a safe status-only failure", async () => {
    const request = vi.fn().mockResolvedValue(new Response("sensitive upstream body", { status: 403 }));
    await expect(dispatchHunterWorkflow({
      token: "fixture-secret-token",
      repository: "owner/repo",
      workflow: "credential-hunter.yml",
      ref: "main",
    }, request)).rejects.toThrow("github_dispatch_http_403");
  });
});
