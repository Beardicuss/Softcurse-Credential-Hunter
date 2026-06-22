const { GRAYHAT_QUERY_PACKS } = require('../core/provider-patterns.cjs');
const { dedupeRecords } = require('../core/dedupe.cjs');
const { getHunterSourceConfig } = require('../core/source-config.cjs');
const { createSourceGuard } = require('../core/source-guard.cjs');
const { buildGrayhatQueries } = require('./grayhat-query-builder.cjs');
const { fetchGrayhatSearch } = require('./grayhat-client.cjs');
const { normalizeGrayhatResults } = require('./grayhat-normalizer.cjs');
const { extractGrayhatFileKeys } = require('./grayhat-content-extractor.cjs');

async function collectGrayhatCandidates(options = {}) {
  const config = options.config || getHunterSourceConfig().grayhat;
  const {
    enabled = false,
    logger = console,
    token = '',
    maxQueries = 6,
    fetchContent = false,
    maxContentFiles = 8,
    maxContentBytes = 262144,
    timeoutMs = 15000,
    userAgent = 'credential-hunter/0.1',
    allowedExtensions = [],
    allowedContentTypes = [],
    safety = {},
  } = config;

  if (!enabled) {
    logger?.log?.('  · GrayHat source disabled for this run.');
    return {
      source: 'grayhat',
      candidates: [],
      unique: [],
      extractedKeys: [],
      summary: {},
      errors: [],
      meta: { enabled: false, reason: 'not_enabled' },
    };
  }

  if (!token) {
    logger?.log?.('  · GrayHat source enabled but token/config is missing.');
    return {
      source: 'grayhat',
      candidates: [],
      unique: [],
      extractedKeys: [],
      summary: {},
      errors: [{ source: 'grayhat', error: 'missing_token' }],
      meta: { enabled: true, reason: 'missing_token' },
    };
  }

  const guard = createSourceGuard({ source: 'GrayHat', logger, ...safety });
  const queries = buildGrayhatQueries(GRAYHAT_QUERY_PACKS).slice(0, maxQueries);
  const candidates = [];
  const errors = [];
  const summary = {};

  for (const query of queries) {
    if (guard.shouldStop()) {
      errors.push({ source: 'grayhat', error: 'stopped_after_error_limit', state: guard.getState() });
      break;
    }

    try {
      await guard.beforeRequest();
      const response = await fetchGrayhatSearch(query, { token, timeoutMs, userAgent, pathPrefix: apiPath });
      if (response.statusCode !== 200) {
        errors.push({ source: 'grayhat', provider: query.provider, keyword: query.keyword, error: `http_${response.statusCode}` });
        await guard.onError(new Error(`http_${response.statusCode}`), { label: query.keyword + ' HTTP ' + response.statusCode });
        continue;
      }

      let payload = null;
      try {
        payload = JSON.parse(response.body || 'null');
      } catch (_) {
        errors.push({ source: 'grayhat', provider: query.provider, keyword: query.keyword, error: 'parse_error' });
        await guard.onError(new Error('parse_error'), { label: query.keyword + ' HTTP ' + response.statusCode });
        continue;
      }

      const records = normalizeGrayhatResults(payload, query);
      candidates.push(...records);
      if (!summary[query.provider]) {
        summary[query.provider] = { candidates: 0, confirmed: 0, valid: 0, invalid: 0, unknown: 0 };
      }
      summary[query.provider].candidates += records.length;
    } catch (error) {
      errors.push({ source: 'grayhat', provider: query.provider, keyword: query.keyword, error: error?.message || 'request_failed' });
      await guard.onError(error, { label: query.keyword });
    }
  }

  const unique = dedupeRecords(candidates);
  let extractedKeys = [];
  if (fetchContent) {
    const subset = unique.slice(0, maxContentFiles);
    for (const record of subset) {
      if (guard.shouldStop()) {
        errors.push({ source: 'grayhat', error: 'content_stopped_after_error_limit', state: guard.getState() });
        break;
      }
      await guard.beforeRequest();
      const extracted = await extractGrayhatFileKeys(record, {
        timeoutMs,
        userAgent,
        maxBytes: maxContentBytes,
        allowedExtensions,
        allowedContentTypes,
      });
      extractedKeys.push(...extracted);
    }
    extractedKeys = dedupeRecords(extractedKeys);
  }

  logger?.log?.(`  · GrayHat source produced ${unique.length} discovery candidate(s) and ${extractedKeys.length} extracted key candidate(s).`);

  return {
    source: 'grayhat',
    candidates,
    unique,
    extractedKeys,
    summary,
    errors,
    meta: { enabled: true, queries: queries.length, fetchedContent: fetchContent, safety: guard.getState() },
  };
}

module.exports = {
  collectGrayhatCandidates,
};
