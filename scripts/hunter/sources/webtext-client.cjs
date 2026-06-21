const https = require('https');
const { URL } = require('url');

function fetchWebText(urlString, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 15000);
  const userAgent = options.userAgent || 'credential-hunter/0.1';
  const url = new URL(urlString);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          Accept: options.accept || 'text/plain,text/html,application/json,text/yaml,application/x-yaml,*/*;q=0.8',
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
            url: urlString,
          });
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Web text request timed out'));
    });
    req.end();
  });
}

module.exports = {
  fetchWebText,
};
