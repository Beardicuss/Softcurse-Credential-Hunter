const { dedupeRecords } = require('../core/dedupe.cjs');
const { getHunterSourceConfig } = require('../core/source-config.cjs');
const { createSourceGuard } = require('../core/source-guard.cjs');
const { extractKeysFromText } = require('../core/text-key-extractor.cjs');
const { fetchWebText } = require('./webtext-client.cjs');
const { normalizeWebTextSeeds, extractWebTextBody } = require('./webtext-normalizer.cjs');

async function collectWebTextCandidates(options = {}) {
  const config = options.config || getHunterSourceConfig().webtext;
  const {
    enabled = false,
    logger = console,
    urls = [],
    timeoutMs = 15000,
    userAgent = 'credential-hunter/0.1',
    maxUrls = 12,
    safety = {},
  } = config || {};

  if (!enabled) {
    logger?.log?.('  · WebText source disabled for this run.');
    return {
      source: 'webtext',
      candidates: [],
      unique: [],
      extractedKeys: [],
      summary: {},
      errors: [],
      meta: { enabled: false, reason: 'not_enabled' },
    }; 
  }

  const guard = createSourceGuard({ source: 'WebText', logger, ...safety });
  const seedRecords = normalizeWebTextSeeds(urls).slice(0, maxUrls);
  const extractedKeys = [];
  const errors = [];
  const summary = {
    'Web Text': { candidates: seedRecords.length, confirmed: 0, valid: 0, invalid: 0, unknown: 0 },
  };

  for (const record of seedRecords) {
    if (guard.shouldStop()) {
      errors.push({ source: 'webtext', error: 'stopped_after_error_limit', state: guard.getState() });
      break;
    }

    try {
      await guard.beforeRequest();
      const response = await fetchWebText(record.source_url || record.commit_url, { timeoutMs, userAgent });
      if (response.statusCode !== 200) {
        errors.push({ source: 'webtext', provider: 'Web Text', url: record.source_url || record.commit_url, error: `http_${response.statusCode}` });
        await guard.onError(new Error(`http_${response.statusCode}`), { label: record.source_url || record.commit_url });
        continue;
      }

      const text = extractWebTextBody(response.body, response.headers || {});
      const keys = extractKeysFromText(text, {
        source: 'webtext',
        sourceType: 'seed-url',
        sourceUrl: record.source_url || record.commit_url || null,
        repo: record,
        query: record.query || null,
        discoveredAt: record.author_date || new Date().toISOString(),
        metadata: {
          seedUrl: record.metadata?.seedUrl || record.source_url || null,
          contentType: String(response.headers?.['content-type'] || ''),
        },
      });
      extractedKeys.push(...keys);
    } catch (error) {
      errors.push({ source: 'webtext', provider: 'Web Text', url: record.source_url || record.commit_url, error: error?.message || 'request_failed' });
      await guard.onError(error, { label: record.source_url || record.commit_url });
    }
  }

  const uniqueExtractedKeys = dedupeRecords(extractedKeys);
  logger?.log?.(`  · WebText source produced ${seedRecords.length} seed candidate(s) and ${uniqueExtractedKeys.length} extracted key candidate(s).`);

  return {
    source: 'webtext',
    candidates: seedRecords,
    unique: seedRecords,
    extractedKeys: uniqueExtractedKeys,
    summary,
    errors,
    meta: { enabled: true, seeds: seedRecords.length, safety: guard.getState() },
  };
}

module.exports = {
  collectWebTextCandidates,
};
