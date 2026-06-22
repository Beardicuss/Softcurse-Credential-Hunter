const fs = require("node:fs");
const path = require("node:path");
const { verifyWorkflowContract } = require("./hunter/core/workflow-contract.cjs");

const workflowPath = path.join(process.cwd(), ".github", "workflows", "credential-hunter.yml");
const result = verifyWorkflowContract(fs.readFileSync(workflowPath, "utf8"));

if (!result.valid) {
  console.error("Workflow contract failed:");
  result.errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Workflow contract verified.");
