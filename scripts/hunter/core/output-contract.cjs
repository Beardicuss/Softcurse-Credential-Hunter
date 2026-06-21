function verifyHunterOutputPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['payload_must_be_object'], summary: emptySummary() };
  }

  if (!isIsoDate(payload.generated_at)) errors.push('generated_at_must_be_iso_date');
  if (!Array.isArray(payload.commits)) errors.push('commits_must_be_array');
  if (payload.source_runs != null && !Array.isArray(payload.source_runs)) {
    errors.push('source_runs_must_be_array');
  }
  for (const [index, run] of (Array.isArray(payload.source_runs) ? payload.source_runs : []).entries()) {
    if (!run || typeof run.source !== 'string' || !run.source.trim()) {
      errors.push(`source_runs[${index}].source_required`);
    }
    if (!run || !['completed', 'failed'].includes(String(run.status))) {
      errors.push(`source_runs[${index}].status_invalid`);
    }
    if (!Number.isFinite(Number(run?.attempts)) || Number(run.attempts) < 1) {
      errors.push(`source_runs[${index}].attempts_invalid`);
    }
  }

  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  let keys = 0;
  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    if (!commit || typeof commit !== 'object') {
      errors.push(`commits[${index}]_must_be_object`);
      continue;
    }
    if (!Array.isArray(commit.leaked_keys)) {
      errors.push(`commits[${index}].leaked_keys_must_be_array`);
      continue;
    }
    keys += commit.leaked_keys.length;
    for (let keyIndex = 0; keyIndex < commit.leaked_keys.length; keyIndex += 1) {
      const key = commit.leaked_keys[keyIndex];
      if (!key || typeof key.provider !== 'string' || !key.provider.trim()) {
        errors.push(`commits[${index}].leaked_keys[${keyIndex}].provider_required`);
      }
      if (!key || !['valid', 'invalid', 'unknown', 'rate_limited'].includes(String(key.validity))) {
        errors.push(`commits[${index}].leaked_keys[${keyIndex}].validity_invalid`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      commits: commits.length,
      keys,
      candidates: finiteCount(payload.total_candidates),
      confirmed: finiteCount(payload.total_confirmed),
    },
  };
}

function finiteCount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function emptySummary() {
  return { commits: 0, keys: 0, candidates: 0, confirmed: 0 };
}

module.exports = { verifyHunterOutputPayload };