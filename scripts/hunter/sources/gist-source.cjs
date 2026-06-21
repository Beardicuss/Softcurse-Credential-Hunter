const { dedupeRecords } = require('../core/dedupe.cjs');
const { getHunterSourceConfig } = require('../core/source-config.cjs');
const { extractKeysFromText } = require('../core/text-key-extractor.cjs');
const { fetchGistSearch, fetchGistPage } = require('./gist-client.cjs');
const { normalizeGistSearchResults, extractGistPageText } = require('./gist-normalizer.cjs');

async function collectGistCandidates(options = {}) {
  const config = options.config || getHunterSourceConfig().gist;
  const {
    enabled = false,
    logger = console,
    maxQueries = 8,
    timeoutMs = 15000,
    userAgent = 'credential-hunter/0.1',
    fetchContent = true,
    maxContentGists = 8,
  } = config || {};
  const searchQueries = Array.isArray(options.searchQueries) ? options.searchQueries : [];

  if (!enabled) {
    logger?.log?.('  · Gist source disabled for this run.');
    return {
      source: 'gist',
      candidates: [],
      unique: [],
      extractedKeys: [],
      summary: {},
      errors: [],
      meta: { enabled: false, reason: 'not_enabled' },
    };
  }

  const queries = searchQueries.slice(0, maxQueries);
  const candidates = [];
  const extractedKeys = [];
  const summary = {};
  const errors = [];

  for (const query of queries) {
    try {
      const response = await fetchGistSearch(query.query, { timeoutMs, userAgent });
      if (response.statusCode !== 200) {
        errors.push({ source: 'gist', provider: query.provider, query: query.query, error: `http_${response.statusCode}` });
        continue;
      }

      const records = normalizeGistSearchResults(response.body, query);
      candidates.push(...records);
      if (!summary[query.provider]) {
        summary[query.provider] = { candidates: 0, confirmed: 0, valid: 0, invalid: 0, unknown: 0 };
      }
      summary[query.provider].candidates += records.length;
    } catch (error) {
      errors.push({ source: 'gist', provider: query.provider, query: query.query, error: error?.message || 'request_failed' });
    }
  }

  const unique = dedupeRecords(candidates);

  if (fetchContent) {
    for (const record of unique.slice(0, maxContentGists)) {
      try {
        const response = await fetchGistPage(record.source_url || record.commit_url, { timeoutMs, userAgent });
        if (response.statusCode !== 200) {
          errors.push({ source: 'gist', provider: record.provider, query: record.query, error: `content_http_${response.statusCode}`, url: record.source_url || record.commit_url });
          continue;
        }
        const text = extractGistPageText(response.body);
        const snippetKeys = extractKeysFromText(text, {
          source: 'gist',
          sourceType: 'gist-page',
          sourceUrl: record.source_url || record.commit_url || null,
          repo: record,
          query: record.query || null,
          discoveredAt: record.author_date || new Date().toISOString(),
          metadata: {
            gistId: record.metadata?.gistId || null,
            owner: record.metadata?.owner || null,
          },
        });
        extractedKeys.push(...snippetKeys);
      } catch (error) {
        errors.push({ source: 'gist', provider: record.provider, query: record.query, error: error?.message || 'content_fetch_failed', url: record.source_url || record.commit_url });
      }
    }
  }

  const uniqueExtractedKeys = dedupeRecords(extractedKeys);
  logger?.log?.(`  · Gist source produced ${unique.length} discovery candidate(s) and ${uniqueExtractedKeys.length} extracted key candidate(s).`);

  return {
    source: 'gist',
    candidates,
    unique,
    extractedKeys: uniqueExtractedKeys,
    summary,
    errors,
    meta: { enabled: true, queries: queries.length, fetchedContent: fetchContent },
  };
}

module.exports = {
  collectGistCandidates,
};
