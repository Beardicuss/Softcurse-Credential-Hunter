const { runWithRetry, sanitizeError } = require('./source-execution.cjs');

function normalizeRunner(entry, index) {
  if (typeof entry === 'function') {
    return { name: entry.sourceName || `source-${index + 1}`, run: entry, policy: {} };
  }
  return {
    name: String(entry?.name || `source-${index + 1}`),
    run: entry?.run,
    policy: entry?.policy || {},
  };
}

async function collectSources(sourceRunners = [], options = {}) {
  const results = [];
  const diagnostics = [];

  for (let index = 0; index < sourceRunners.length; index += 1) {
    const runner = normalizeRunner(sourceRunners[index], index);
    if (typeof runner.run !== 'function') continue;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    try {
      const execution = await runWithRetry(runner.run, {
        maxAttempts: runner.policy.maxAttempts ?? options.maxAttempts ?? 2,
        baseDelayMs: runner.policy.baseDelayMs ?? options.baseDelayMs ?? 750,
        sleep: options.sleep,
      });
      if (execution.value) results.push(execution.value);
      diagnostics.push(buildDiagnostic(runner.name, execution.value, {
        status: 'completed',
        attempts: execution.attempts,
        startedAt,
        durationMs: Date.now() - startedMs,
      }));
    } catch (error) {
      diagnostics.push(buildDiagnostic(runner.name, null, {
        status: 'failed',
        attempts: Number(error?.attempts || runner.policy.maxAttempts || options.maxAttempts || 2),
        startedAt,
        durationMs: Date.now() - startedMs,
        error: sanitizeError(error),
      }));
    }
  }

  Object.defineProperty(results, 'diagnostics', {
    value: diagnostics,
    enumerable: false,
  });
  return results;
}

function buildDiagnostic(name, result, execution) {
  return {
    source: String(result?.source || name),
    status: execution.status,
    attempts: execution.attempts,
    startedAt: execution.startedAt,
    durationMs: execution.durationMs,
    candidates: countResultItems(result),
    errors: Array.isArray(result?.errors) ? result.errors.length : execution.error ? 1 : 0,
    error: execution.error || undefined,
  };
}

function countResultItems(result) {
  const collections = ['unique', 'extractedKeys', 'candidates', 'records'];
  return collections.reduce((total, key) => total + (Array.isArray(result?.[key]) ? result[key].length : 0), 0);
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
