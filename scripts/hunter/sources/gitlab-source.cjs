const { dedupeRecords } = require('../core/dedupe.cjs');
const { getHunterSourceConfig } = require('../core/source-config.cjs');
const { createSourceGuard } = require('../core/source-guard.cjs');
const { extractKeysFromText } = require('../core/text-key-extractor.cjs');
const { fetchGitLabSearch } = require('./gitlab-client.cjs');
const { normalizeGitLabResults } = require('./gitlab-normalizer.cjs');

async function collectGitLabCandidates(options = {}) {
  const config = options.config || getHunterSourceConfig().gitlab;
  const {
    enabled = false,
    logger = console,
    token = '',
    baseUrl = 'https://gitlab.com',
    maxQueries = 8,
    timeoutMs = 15000,
    userAgent = 'credential-hunter/0.1',
    useSnippetExtraction = true,
    safety = {},
  } = config;
  const searchQueries = Array.isArray(options.searchQueries) ? options.searchQueries : [];

  if (!enabled) {
    logger?.log?.('  · GitLab source disabled for this run.');
    return {
      source: 'gitlab',
      candidates: [],
      unique: [],
      extractedKeys: [],
      summary: {},
      errors: [],
      meta: { enabled: false, reason: 'not_enabled' },
    };
  }

  const guard = createSourceGuard({ source: 'GitLab', logger, ...safety });
  const queries = searchQueries.slice(0, maxQueries);
  const candidates = [];
  const extractedKeys = [];
  const summary = {};
  const errors = [];

  for (const query of queries) {
    if (guard.shouldStop()) {
      errors.push({ source: 'gitlab', error: 'stopped_after_error_limit', state: guard.getState() });
      break;
    }

    try {
      await guard.beforeRequest();
      const response = await fetchGitLabSearch(query.query, {
        baseUrl,
        token,
        timeoutMs,
        userAgent,
      });
      if (response.statusCode !== 200) {
        errors.push({ source: 'gitlab', provider: query.provider, query: query.query, error: `http_${response.statusCode}` });
        await guard.onError(new Error(`http_${response.statusCode}`), { label: query.query });
        continue;
      }

      let payload = null;
      try {
        payload = JSON.parse(response.body || '[]');
      } catch (_) {
        errors.push({ source: 'gitlab', provider: query.provider, query: query.query, error: 'parse_error' });
        await guard.onError(new Error('parse_error'), { label: query.query });
        continue;
      }

      const records = normalizeGitLabResults(payload, query, { baseUrl });
      candidates.push(...records);
      if (!summary[query.provider]) {
        summary[query.provider] = { candidates: 0, confirmed: 0, valid: 0, invalid: 0, unknown: 0 };
      }
      summary[query.provider].candidates += records.length;

      if (useSnippetExtraction) {
        for (const record of records) {
          const snippetKeys = extractKeysFromText(record.snippet || '', {
            source: 'gitlab',
            sourceType: 'blob-snippet',
            sourceUrl: record.source_url || record.commit_url || null,
            repo: record,
            query: record.query || null,
            discoveredAt: record.author_date || new Date().toISOString(),
            lineOffset: record.metadata?.startline || 0,
            metadata: {
              project_path: record.project_path || null,
              file_path: record.file_path || null,
              ref: record.ref || null,
            },
          });
          extractedKeys.push(...snippetKeys);
        }
      }
    } catch (error) {
      errors.push({ source: 'gitlab', provider: query.provider, query: query.query, error: error?.message || 'request_failed' });
      await guard.onError(error, { label: query.query });
    }
  }

  const unique = dedupeRecords(candidates);
  const uniqueExtractedKeys = dedupeRecords(extractedKeys);

  logger?.log?.(`  · GitLab source produced ${unique.length} discovery candidate(s) and ${uniqueExtractedKeys.length} extracted key candidate(s).`);

  return {
    source: 'gitlab',
    candidates,
    unique,
    extractedKeys: uniqueExtractedKeys,
    summary,
    errors,
    meta: { enabled: true, queries: queries.length, snippetExtraction: useSnippetExtraction, safety: guard.getState() },
  };
}

module.exports = {
  collectGitLabCandidates,
};
