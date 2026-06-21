async function collectGitHubCandidates(options = {}) {
  const {
    searchQueries = [],
    searchGitHub,
    delay,
    delayBetweenRequestsMs = 0,
  } = options;

  if (typeof searchGitHub !== 'function') {
    throw new Error('collectGitHubCandidates requires searchGitHub');
  }

  const candidates = [];
  const summary = {};
  const errors = [];

  for (const { provider, query } of searchQueries) {
    const result = await searchGitHub(provider, query);
    candidates.push(...(result.results || []));
    if (!summary[provider]) {
      summary[provider] = { candidates: 0, confirmed: 0, valid: 0, invalid: 0, unknown: 0 };
    }
    summary[provider].candidates += (result.results || []).length;
    if (result.error) errors.push({ provider, query, error: result.error });
    if (typeof delay === 'function' && delayBetweenRequestsMs > 0) {
      await delay(delayBetweenRequestsMs);
    }
  }

  const seen = new Set();
  const unique = candidates.filter((record) => {
    if (!record.sha || seen.has(record.sha)) return false;
    seen.add(record.sha);
    return true;
  });

  return {
    source: 'github',
    candidates,
    unique,
    summary,
    errors,
  };
}

module.exports = {
  collectGitHubCandidates,
};
