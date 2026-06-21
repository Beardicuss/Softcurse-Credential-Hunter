async function collectSources(sourceRunners = []) {
  const results = [];
  for (const runner of sourceRunners) {
    if (typeof runner !== 'function') continue;
    const result = await runner();
    if (result) results.push(result);
  }
  return results;
}

function mergeSourceErrors(results = []) {
  return results.flatMap((item) => Array.isArray(item?.errors) ? item.errors : []);
}

function mergeSourceSummaries(results = []) {
  const merged = {};
  for (const item of results) {
    const summary = item?.summary || {};
    for (const [provider, stats] of Object.entries(summary)) {
      const current = merged[provider] || { candidates: 0, confirmed: 0, valid: 0, invalid: 0, unknown: 0 };
      merged[provider] = {
        candidates: current.candidates + Number(stats.candidates || 0),
        confirmed: current.confirmed + Number(stats.confirmed || 0),
        valid: current.valid + Number(stats.valid || 0),
        invalid: current.invalid + Number(stats.invalid || 0),
        unknown: current.unknown + Number(stats.unknown || 0),
      };
    }
  }
  return merged;
}

module.exports = {
  collectSources,
  mergeSourceErrors,
  mergeSourceSummaries,
};
