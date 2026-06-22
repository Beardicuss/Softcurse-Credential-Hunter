const { GRAYHAT_QUERY_PACKS } = require('../core/provider-patterns.cjs');
const { dedupeRecords } = require('../core/dedupe.cjs');
const { getHunterSourceConfig } = require('../core/source-config.cjs');
const { createSourceGuard } = require('../core/source-guard.cjs');
const { buildGrayhatQueries } = require('./grayhat-query-builder.cjs');
const { fetchGrayhatSearch } = require('./grayhat-client.cjs');
const { normalizeGrayhatResults, getGrayhatItems } = require('./grayhat-normalizer.cjs');
const { extractGrayhatFileKeys } = require('./grayhat-content-extractor.cjs');

async function collectGrayhatCandidates(options = {}) {
  const config = options.config || getHunterSourceConfig().grayhat;
  const fetchSearch = options.fetchSearch || fetchGrayhatSearch;
  const logger = options.logger || console;
  const state = options.state || { queryOffset: 0, seenFingerprints: [] };
  const enabled = Boolean(config.enabled);
  const token = String(config.token || '');
  const maxQueries = Math.max(1, Number(config.maxQueries || 6));
  const maxPagesPerQuery = Math.max(1, Number(config.maxPagesPerQuery || 2));
  const pageSize = Math.max(1, Math.min(100, Number(config.pageSize || 100)));
  const maxRequests = Math.max(1, Number(config.maxRequests || 12));
  const apiPath = config.apiPath || '/api/v2/files';
  const guard = createSourceGuard({ source: 'GrayHat', logger, ...(config.safety || {}) });

  if (!enabled || !token) {
    const reason = enabled ? 'missing_token' : 'not_enabled';
    logger.log('  · GrayHat source ' + (enabled ? 'enabled but token/config is missing.' : 'disabled for this run.'));
    return emptyResult(enabled, reason, state);
  }

  const allQueries = buildGrayhatQueries(GRAYHAT_QUERY_PACKS, {
    maxKeywordsPerPack: 4,
    offset: state.queryOffset || 0,
    limit: maxQueries,
  });
  const seen = new Set(Array.isArray(state.seenFingerprints) ? state.seenFingerprints : []);
  const candidates = [];
  const errors = [];
  const summary = {};
  const health = {
    requests: 0,
    pages: 0,
    queries: allQueries.length,
    discovered: 0,
    newFiles: 0,
    duplicatesSkipped: 0,
    contentAttempted: 0,
    contentExtracted: 0,
    contentSkipped: 0,
  };

  outer:
  for (const query of allQueries) {
    for (let page = 1; page <= maxPagesPerQuery; page += 1) {
      if (guard.shouldStop() || health.requests >= maxRequests) break outer;
      try {
        await guard.beforeRequest();
        health.requests += 1;
        const response = await fetchSearch(query, {
          token,
          timeoutMs: config.timeoutMs,
          userAgent: config.userAgent,
          pathPrefix: apiPath,
          page,
          pageSize,
        });
        if (response.statusCode !== 200) {
          errors.push({ source: 'grayhat', provider: query.provider, keyword: query.keyword, page, error: 'http_' + response.statusCode });
          await guard.onError(new Error('http_' + response.statusCode), { label: query.keyword + ' HTTP ' + response.statusCode });
          if (response.statusCode === 401 || response.statusCode === 403 || response.statusCode === 429) break outer;
          break;
        }

        let payload;
        try {
          payload = JSON.parse(response.body || 'null');
        } catch {
          errors.push({ source: 'grayhat', provider: query.provider, keyword: query.keyword, page, error: 'parse_error' });
          await guard.onError(new Error('parse_error'), { label: query.keyword });
          break;
        }

        health.pages += 1;
        const records = normalizeGrayhatResults(payload, query);
        health.discovered += records.length;
        for (const record of records) {
          if (seen.has(record.fingerprint)) {
            health.duplicatesSkipped += 1;
            continue;
          }
          seen.add(record.fingerprint);
          candidates.push(record);
          health.newFiles += 1;
        }
        ensureSummary(summary, query.provider).candidates += records.length;
        if (!hasNextPage(payload, records.length, page, pageSize)) break;
      } catch (error) {
        const safeReason = sanitizeGrayhatError(error);
        errors.push({ source: 'grayhat', provider: query.provider, keyword: query.keyword, error: safeReason });
        logger.log('  · GrayHat request failed (' + query.keyword + '): ' + safeReason);
        await guard.onError(error, { label: query.keyword });
        break;
      }
    }
  }

  const unique = dedupeRecords(candidates);
  let extractedKeys = [];
  if (config.fetchContent) {
    for (const record of unique.slice(0, Math.max(0, Number(config.maxContentFiles || 8)))) {
      health.contentAttempted += 1;
      const extracted = await extractGrayhatFileKeys(record, {
        timeoutMs: config.timeoutMs,
        userAgent: config.userAgent,
        maxBytes: config.maxContentBytes,
        allowedExtensions: config.allowedExtensions,
        allowedContentTypes: config.allowedContentTypes,
      });
      if (extracted.length) {
        extractedKeys.push(...extracted);
        health.contentExtracted += extracted.length;
      } else {
        health.contentSkipped += 1;
      }
    }
    extractedKeys = dedupeRecords(extractedKeys);
  }

  const nextState = {
    queryOffset: (Number(state.queryOffset || 0) + allQueries.length) % Math.max(1, queryCount()),
    seenFingerprints: Array.from(seen).slice(-5000),
  };
  logger.log('  · GrayHat health: ' + health.requests + ' request(s), ' + health.pages + ' page(s), ' + health.newFiles + ' new file(s), ' + health.duplicatesSkipped + ' duplicate(s), ' + extractedKeys.length + ' extracted key(s).');

  return {
    source: 'grayhat',
    candidates,
    unique,
    extractedKeys,
    summary,
    errors,
    meta: { enabled: true, health, nextState, safety: guard.getState() },
  };
}

function hasNextPage(payload, itemCount, page, pageSize) {
  const pagination = payload?.pagination || payload?.meta?.pagination || {};
  if (payload?.has_more === true || pagination?.has_more === true) return true;
  const next = payload?.next_page ?? pagination?.next_page;
  if (next != null) return Boolean(next);
  const last = Number(payload?.last_page ?? pagination?.last_page ?? 0);
  if (last > 0) return page < last;
  return itemCount >= pageSize;
}

function queryCount() {
  return buildGrayhatQueries(GRAYHAT_QUERY_PACKS, { maxKeywordsPerPack: 4 }).length;
}

function ensureSummary(summary, provider) {
  if (!summary[provider]) summary[provider] = { candidates: 0, confirmed: 0, valid: 0, invalid: 0, unknown: 0 };
  return summary[provider];
}

function sanitizeGrayhatError(error) {
  return String(error?.message || 'request_failed')
    .replace(/access_token=[^&\s]+/gi, 'access_token=***')
    .slice(0, 180);
}

function emptyResult(enabled, reason, state) {
  return {
    source: 'grayhat',
    candidates: [],
    unique: [],
    extractedKeys: [],
    summary: {},
    errors: reason === 'missing_token' ? [{ source: 'grayhat', error: reason }] : [],
    meta: { enabled, reason, nextState: state },
  };
}

module.exports = { collectGrayhatCandidates, hasNextPage, sanitizeGrayhatError };
