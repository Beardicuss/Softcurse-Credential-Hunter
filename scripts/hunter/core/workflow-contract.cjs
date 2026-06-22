const REQUIRED_STEPS = [
  "pnpm install --frozen-lockfile",
  "pnpm hunt:check",
  "pnpm test",
  "pnpm check",
  "pnpm build",
  "pnpm pages:build",
  "pnpm workflow:verify",
  "pnpm db:migrate",
  "pnpm hunt",
  "pnpm hunt:verify",
  "pnpm hunt:sync",
  "pnpm hunt:lifecycle",
];

function verifyWorkflowContract(source) {
  const errors = [];
  if (!source.includes('cron: "0 */6 * * *"')) {
    errors.push("scheduled hunt must run every six hours");
  }

  const lines = source.split(/\r?\n/).map((line) => line.trim());
  let previousIndex = -1;
  for (const step of REQUIRED_STEPS) {
    const index = lines.indexOf("run: " + step);
    if (index === -1) {
      errors.push("missing workflow command: " + step);
    } else if (index < previousIndex) {
      errors.push("workflow command is out of order: " + step);
    }
    previousIndex = Math.max(previousIndex, index);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { REQUIRED_STEPS, verifyWorkflowContract };
