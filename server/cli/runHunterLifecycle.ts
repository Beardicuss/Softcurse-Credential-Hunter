import { runCandidateLifecycle } from "../runHunterLifecycle";

runCandidateLifecycle({ apply: process.env.HUNTER_RETENTION_APPLY === "true" })
  .then(result => {
    const mode = result.applied ? "Applied" : "Dry run";
    console.log("[Hunter Lifecycle] " + mode + ": " + result.totals.revalidate + " revalidation, " + result.totals.deleteCandidates + " deletion candidate(s).");
  })
  .catch(error => {
    console.error("[Hunter Lifecycle] Failed:", error);
    process.exitCode = 1;
  });
