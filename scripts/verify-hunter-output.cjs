const fs = require('node:fs');
const path = require('node:path');
const { verifyHunterOutputPayload } = require('./hunter/core/output-contract.cjs');

const outputPath = path.join(__dirname, 'leaked-api-keys.json');
if (!fs.existsSync(outputPath)) {
  console.error('[Hunter Verify] Output file is missing.');
  process.exit(1);
}

try {
  const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const result = verifyHunterOutputPayload(payload);
  if (!result.valid) {
    console.error(`[Hunter Verify] Invalid output: ${result.errors.join(', ')}`);
    process.exit(1);
  }
  console.log(`[Hunter Verify] Valid output: ${result.summary.commits} commits, ${result.summary.keys} keys, ${result.summary.candidates} candidates.`);
} catch (error) {
  console.error(`[Hunter Verify] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
