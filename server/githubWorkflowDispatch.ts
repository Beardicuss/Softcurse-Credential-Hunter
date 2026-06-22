export interface WorkflowDispatchConfig {
  token: string;
  repository: string;
  workflow: string;
  ref: string;
}

export async function dispatchHunterWorkflow(
  config: WorkflowDispatchConfig,
  request: typeof fetch = fetch,
) {
  if (!config.token) throw new Error("missing_workflow_token");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) {
    throw new Error("invalid_workflow_repository");
  }
  if (!config.workflow) throw new Error("missing_workflow_name");
  if (!config.ref) throw new Error("missing_workflow_ref");

  const repository = config.repository.split("/").map(encodeURIComponent).join("/");
  const workflow = encodeURIComponent(config.workflow);
  const response = await request(
    "https://api.github.com/repos/" + repository + "/actions/workflows/" + workflow + "/dispatches",
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + config.token,
        "Content-Type": "application/json",
        "User-Agent": "softcurse-credential-hunter",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: config.ref }),
    },
  );

  if (response.status !== 204) {
    throw new Error("github_dispatch_http_" + response.status);
  }

  return {
    accepted: true as const,
    repository: config.repository,
    workflow: config.workflow,
    ref: config.ref,
  };
}
