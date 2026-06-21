const fs = require('node:fs');
const path = require('node:path');

function buildHunterOutput({
  generatedAt,
  totalCandidates,
  confirmed,
  summary,
  sourceRuns = [],
  errors = [],
}) {
  return {
    generated_at: generatedAt,
    total_candidates: Number(totalCandidates || 0),
    total_confirmed: confirmed.length,
    total_confirmed_commits: confirmed.length,
    summary_by_provider: summary,
    source_runs: sourceRuns,
    failed_queries: errors.length > 0 ? errors : undefined,
    commits: confirmed,
  };
}

function writeHunterOutput(outputPath, payload, fileSystem = fs) {
  const directory = path.dirname(outputPath);
  fileSystem.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    fileSystem.writeFileSync(temporaryPath, JSON.stringify(payload, null, 2), 'utf8');
    fileSystem.renameSync(temporaryPath, outputPath);
  } catch (error) {
    try {
      if (fileSystem.existsSync(temporaryPath)) fileSystem.unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write failure.
    }
    throw error;
  }

  return outputPath;
}

function logHunterRunSummary({ outputPath, confirmedCount, summary, errors = [] }, logger = console) {
  logger.log('\n─────────────────────────────────────────');
  logger.log(`✅ Done. ${confirmedCount} confirmed leaks saved to:`);
  logger.log(`   ${outputPath}`);
  logger.log('\nSummary by provider:');
  for (const [provider, stats] of Object.entries(summary || {})) {
    const candidates = Number(stats.candidates || 0);
    const confirmed = Number(stats.confirmed || 0);
    const valid = Number(stats.valid || 0);
    const invalid = Number(stats.invalid || 0);
    const unknown = Number(stats.unknown || 0);
    logger.log(`   ${provider.padEnd(22)} ${confirmed} confirmed (${candidates} candidates) - Valid: ${valid}, Invalid: ${invalid}, Unknown: ${unknown}`);
  }
  if (errors.length > 0) {
    logger.log(`\n⚠️  ${errors.length} query/queries failed (see failed_queries in output).`);
  }
}

module.exports = {
  buildHunterOutput,
  logHunterRunSummary,
  writeHunterOutput,
};
