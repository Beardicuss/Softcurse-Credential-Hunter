const https = require('node:https');

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/147.0.0.0 Safari/537.36';

function createHttpGet({ timeoutMs = 15000, transport = https } = {}) {
  return (hostname, requestPath, headers = {}) => new Promise((resolve, reject) => {
    const request = transport.request(
      { hostname, path: requestPath, method: 'GET', headers, timeout: timeoutMs },
      (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({ statusCode: response.statusCode, body }));
      },
    );
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timed out'));
    });
    request.end();
  });
}

function isHtml(body = '') {
  const text = String(body).trimStart().toLowerCase();
  return text.startsWith('<!doctype') || text.startsWith('<html');
}

function extractGitHubResult(raw, provider, query) {
  const repository = raw?.repository?.repository ?? {};
  return {
    provider,
    query,
    sha: raw?.sha ?? null,
    commit_url: repository.owner_login && repository.name && raw?.sha
      ? `https://github.com/${repository.owner_login}/${repository.name}/commit/${raw.sha}`
      : null,
    author_date: raw?.author_date ?? null,
    message: raw?.message ?? null,
    author: raw?.authors?.[0]?.login ?? null,
    repo_owner: repository.owner_login ?? null,
    repo_name: repository.name ?? null,
    repo_url: repository.owner_login && repository.name
      ? `https://github.com/${repository.owner_login}/${repository.name}`
      : null,
    verification_status: raw?.verification_status ?? null,
  };
}

function createGitHubClient(options = {}) {
  const httpGet = options.httpGet || createHttpGet({ timeoutMs: options.timeoutMs });
  const delay = options.delay || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logger = options.logger || console;
  const fetchNonce = options.fetchNonce || '';
  const maxRetries = Math.max(0, Number(options.maxRetries ?? 5));
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs ?? 10000));
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  async function fetchDiff(owner, repository, sha) {
    try {
      const response = await httpGet('github.com', `/${owner}/${repository}/commit/${sha}.diff`, {
        'user-agent': userAgent,
        accept: 'text/plain',
      });
      if (response.statusCode === 200 && !isHtml(response.body)) return response.body;
    } catch (error) {
      logger.error(`Error fetching diff for ${owner}/${repository}/${sha}: ${error.message}`);
    }
    return null;
  }

  async function searchGitHub(provider, query, attempt = 1) {
    let response;
    try {
      response = await httpGet('github.com', `/search?q=${encodeURIComponent(query)}&type=commits`, {
        accept: 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        'x-github-target': 'dotcom',
        ...(fetchNonce ? { 'x-fetch-nonce': fetchNonce } : {}),
        'user-agent': userAgent,
      });
    } catch (error) {
      logger.error(`Error during GitHub search for "${query}": ${error.message}`);
      return { provider, query, results: [], error: error.message };
    }

    const rateLimited = [403, 429].includes(response.statusCode) || isHtml(response.body);
    if (rateLimited) {
      if (attempt <= maxRetries) {
        const wait = retryDelayMs * attempt;
        logger.warn(`  [${provider}] "${query}" rate limited; retry ${attempt}/${maxRetries} in ${wait}ms`);
        await delay(wait);
        return searchGitHub(provider, query, attempt + 1);
      }
      return { provider, query, results: [], error: 'rate_limited' };
    }

    try {
      const json = JSON.parse(response.body);
      const results = (json?.payload?.results ?? []).map((raw) => extractGitHubResult(raw, provider, query));
      logger.log(`  [${provider}] "${query}" -> ${results.length} candidate(s)`);
      return { provider, query, results, error: null };
    } catch (error) {
      logger.warn(`  [${provider}] "${query}" parse error: ${error.message}`);
      return { provider, query, results: [], error: 'parse_error' };
    }
  }

  return { fetchDiff, searchGitHub };
}

module.exports = {
  createGitHubClient,
  createHttpGet,
  extractGitHubResult,
  isHtml,
};
