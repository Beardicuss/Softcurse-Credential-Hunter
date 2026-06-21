const https = require('https');
const { URL } = require('url');

function fetchUrl(rawUrl, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 15000);
  const userAgent = options.userAgent || 'credential-hunter/0.1';
  const url = new URL(rawUrl);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          Accept: options.accept || 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'User-Agent': userAgent,
        },
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
            url: rawUrl,
          });
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Gist request timed out'));
    });
    req.end();
  });
}

function buildGistSearchUrl(query) {
  const url = new URL('https://gist.github.com/search');
  url.searchParams.set('q', query);
  return url.toString();
}

function fetchGistSearch(query, options = {}) {
  return fetchUrl(buildGistSearchUrl(query), options);
}

function fetchGistPage(gistUrl, options = {}) {
  return fetchUrl(gistUrl, options);
}

module.exports = {
  buildGistSearchUrl,
  fetchGistSearch,
  fetchGistPage,
};
