const https = require('node:https');
const crypto = require('node:crypto');

const DEFAULT_TIMEOUT_MS = 15000;

function requestHttp(options) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: options.hostname,
        path: options.path,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({ statusCode: response.statusCode, body }));
      },
    );
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data).digest(encoding);
}

function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function statusResult(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return 'valid';
  if (statusCode === 429) return 'valid';
  if ([400, 401, 403].includes(statusCode)) return 'invalid';
  return `unknown_status_${statusCode}`;
}

function createKeyValidator({ request = requestHttp, timeoutMs = DEFAULT_TIMEOUT_MS, now = () => new Date() } = {}) {
  async function validateAWSPair(accessKeyId, secretAccessKey) {
    const service = 'sts';
    const region = 'us-east-1';
    const hostname = 'sts.amazonaws.com';
    const amzDate = now().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const body = 'Action=GetCallerIdentity&Version=2011-06-15';
    const signedHeaders = 'host;x-amz-date';
    const canonicalRequest = `POST\n/\n\nhost:${hostname}\nx-amz-date:${amzDate}\n\n${signedHeaders}\n${hash(body)}`;
    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hash(canonicalRequest)}`;
    const kDate = hmac(`AWS4${secretAccessKey}`, date);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const signature = hmac(hmac(kService, 'aws4_request'), stringToSign, 'hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await request({
      hostname,
      path: '/',
      method: 'POST',
      body,
      timeoutMs,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Date': amzDate,
        Authorization: authorization,
        'User-Agent': 'Key-Validator/1.0',
      },
    });
    if (response.statusCode >= 200 && response.statusCode < 300) return 'valid';
    if (response.statusCode === 403) return 'invalid';
    return `unknown_status_${response.statusCode}`;
  }

  async function validateAzurePair(clientId, clientSecret, tenantId) {
    const body = `client_id=${clientId}&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const response = await request({
      hostname: 'login.microsoftonline.com',
      path: `/${tenantId}/oauth2/v2.0/token`,
      method: 'POST',
      body,
      timeoutMs,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Key-Validator/1.0' },
    });
    if (response.statusCode >= 200 && response.statusCode < 300) return 'valid';
    if ([400, 401].includes(response.statusCode)) return 'invalid';
    return `unknown_status_${response.statusCode}`;
  }

  async function validateTwilioPair(accountSid, authToken) {
    const authorization = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}.json`,
      timeoutMs,
      headers: { Authorization: `Basic ${authorization}`, 'User-Agent': 'Key-Validator/1.0' },
    });
    if (response.statusCode >= 200 && response.statusCode < 300) return 'valid';
    if ([401, 403].includes(response.statusCode)) return 'invalid';
    return `unknown_status_${response.statusCode}`;
  }

  return async function checkKeyValidity(provider, value) {
    try {
      const special = await resolveSpecialProvider(provider, value, {
        validateAWSPair,
        validateAzurePair,
        validateTwilioPair,
      });
      if (special) return special;

      const probe = buildProviderProbe(provider, value, timeoutMs);
      if (!probe) return 'unknown_provider';
      const response = await request(probe);
      return statusResult(response.statusCode);
    } catch (error) {
      console.error(`Error checking key validity for ${provider}: ${error.message}`);
      return 'error';
    }
  };
}

async function resolveSpecialProvider(provider, value, validators) {
  const staticResults = {
    AWS: 'unknown_requires_secret',
    'AWS Secret': 'unknown_requires_id',
    'Azure Client ID': 'unknown_requires_full_client_info',
    'Azure Client Secret': 'unknown_requires_full_client_info',
    'Azure Tenant ID': 'unknown_requires_full_client_info',
    'Azure Hex': 'unknown_azure_hex_validation_complex',
    'Twilio SID': 'unknown_requires_token',
    'Twilio Token': 'unknown_requires_sid',
    'Twilio Bare Token': 'unknown_requires_sid',
    Twilio: 'unknown_twilio_validation_requires_account_sid',
    JWT: 'unknown_jwt_validation_complex',
  };
  if (staticResults[provider]) return staticResults[provider];
  if (provider === 'AWS Pair') return validators.validateAWSPair(value.id, value.secret);
  if (provider === 'Azure Pair') return validators.validateAzurePair(value.id, value.secret, value.tenant);
  if (provider === 'Twilio Pair') return validators.validateTwilioPair(value.sid, value.token);
  return null;
}

function buildProviderProbe(provider, value, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const bearer = (hostname, path, scheme = 'Bearer') => ({
    hostname,
    path,
    timeoutMs,
    headers: { 'user-agent': 'Key-Validator/1.0', accept: 'application/json', Authorization: `${scheme} ${value}` },
  });
  const probes = {
    Anthropic: { hostname: 'api.anthropic.com', path: '/v1/models', timeoutMs, headers: { 'user-agent': 'Key-Validator/1.0', accept: 'application/json', 'x-api-key': value, 'anthropic-version': '2023-06-01' } },
    OpenAI: bearer('api.openai.com', '/v1/models'),
    'xAI / Grok': bearer('api.x.ai', '/v1/models'),
    'Google Gemini': { hostname: 'generativelanguage.googleapis.com', path: `/v1beta/models?key=${value}`, timeoutMs, headers: { 'user-agent': 'Key-Validator/1.0', accept: 'application/json' } },
    Mistral: bearer('api.mistral.ai', '/v1/models'),
    Cohere: bearer('api.cohere.com', '/v1/models'),
    'Hugging Face': bearer('huggingface.co', '/api/whoami-v2'),
    'Together AI': bearer('api.together.xyz', '/v1/models'),
    Replicate: bearer('api.replicate.com', '/v1/models', 'Token'),
    Stripe: bearer('api.stripe.com', '/v1/accounts'),
    'GitHub PAT': bearer('api.github.com', '/user', 'token'),
  };
  return probes[provider] || null;
}

const checkKeyValidity = createKeyValidator();

module.exports = {
  buildProviderProbe,
  createKeyValidator,
  statusResult,
  checkKeyValidity,
};