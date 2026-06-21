const https = require('https');
const { URL } = require('url');

function buildGitLabSearchPath(query, options = {}) {
  const perPage = Number(options.perPage || 20);
  const page = Number(options.page || 1);
  const url = new URL('/api/v4/search', options.baseUrl || 'https://gitlab.com');
  url.searchParams.set('scope', 'blobs');
  url.searchParams.set('search', query);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  return `${url.pathname}${url.search}`;
}

function fetchGitLabSearch(query, options = {}) {
  const baseUrl = options.baseUrl || 'https://gitlab.com';
  const timeoutMs = Number(options.timeoutMs || 15000);
  const userAgent = options.userAgent || 'credential-hunter/0.1';
  const token = String(options.token || '').trim();
  const url = new URL(baseUrl);
  const path = buildGitLabSearchPath(query, { baseUrl, perPage: options.perPage, page: options.page });

  const headers = {
    Accept: 'application/json',
    'User-Agent': userAgent,
  };
  if (token) headers['PRIVATE-TOKEN'] = token;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path,
        method: 'GET',
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
            headers: res.headers || {},
          });
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('GitLab request timed out'));
    });
    req.end();
  });
}

module.exports = {
  buildGitLabSearchPath,
  fetchGitLabSearch,
};
