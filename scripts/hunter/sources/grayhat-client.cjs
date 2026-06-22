const https = require('https');

function fetchGrayhatSearch(query, options = {}) {
  const {
    hostname = 'buckets.grayhatwarfare.com',
    pathPrefix = '/api/v2/files',
    userAgent = 'credential-hunter/0.1',
    timeoutMs = 15000,
    token = process.env.GRAYHAT_TOKEN || '',
  } = options;

  const params = new URLSearchParams();
  if (query?.keyword) params.set('keywords', query.keyword);
  if (query?.extensionQuery) params.set('extensions', query.extensionQuery);
  if (token) params.set('access_token', token);

  const path = `${pathPrefix}?${params.toString()}`;
  const headers = {
    accept: 'application/json',
    'user-agent': userAgent,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers['x-api-key'] = token;
  }

  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers, timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body, headers: res.headers || {} });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GrayHat request timed out'));
    });
    req.end();
  });
}

function fetchGrayhatFile(urlString, options = {}) {
  const {
    timeoutMs = 15000,
    userAgent = 'credential-hunter/0.1',
    maxBytes = 262144,
  } = options;

  if (!urlString) {
    return Promise.resolve({ statusCode: 0, body: '', headers: {}, skipped: 'missing_url' });
  }

  const url = new URL(urlString);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search || ''}`,
      method: 'GET',
      headers: { 'user-agent': userAgent },
      timeout: timeoutMs,
    }, (res) => {
      let body = '';
      let byteCount = 0;
      res.on('data', (chunk) => {
        byteCount += chunk.length;
        if (byteCount <= maxBytes) {
          body += chunk.toString('utf8');
        }
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body,
          headers: res.headers || {},
          truncated: byteCount > maxBytes,
          bytesRead: byteCount,
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GrayHat file request timed out'));
    });
    req.end();
  });
}

module.exports = {
  fetchGrayhatSearch,
  fetchGrayhatFile,
};
