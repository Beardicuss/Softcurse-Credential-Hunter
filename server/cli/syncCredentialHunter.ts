import {
  getDefaultCredentialHunterPath,
  syncCredentialHunterOutput,
} from "../credentialHunterIntegration";

console.log("[Credential Hunter Sync] Starting database integration...");
syncCredentialHunterOutput(getDefaultCredentialHunterPath())
  .then(() => {
    console.log("[Credential Hunter Sync] Complete.");
  })
  .catch(error => {
    console.error("[Credential Hunter Sync] Fatal error:", error);
    process.exitCode = 1;
  });
