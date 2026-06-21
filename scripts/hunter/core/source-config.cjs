function toBool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toInt(value, fallback) {
  const num = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(num) ? num : fallback;
}

function toList(value) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceSafety(env, prefix, defaults = {}) {
  return {
    minDelayMs: toInt(env[`${prefix}_MIN_DELAY_MS`], defaults.minDelayMs ?? 250),
    maxErrors: toInt(env[`${prefix}_MAX_ERRORS`], defaults.maxErrors ?? 5),
    cooldownOnErrorMs: toInt(env[`${prefix}_COOLDOWN_ON_ERROR_MS`], defaults.cooldownOnErrorMs ?? 1000),
  };
}

function getHunterSourceConfig(env = process.env) {
  return {
    grayhat: {
      enabled: toBool(env.GRAYHAT_ENABLED, false),
      token: String(env.GRAYHAT_TOKEN || '').trim(),
      fetchContent: toBool(env.GRAYHAT_FETCH_CONTENT, false),
      maxQueries: toInt(env.GRAYHAT_MAX_QUERIES, 6),
      maxContentFiles: toInt(env.GRAYHAT_MAX_CONTENT_FILES, 8),
      maxContentBytes: toInt(env.GRAYHAT_MAX_CONTENT_BYTES, 262144),
      timeoutMs: toInt(env.GRAYHAT_TIMEOUT_MS, 15000),
      userAgent: String(env.GRAYHAT_USER_AGENT || 'credential-hunter/0.1').trim(),
      allowedExtensions: String(env.GRAYHAT_ALLOWED_EXTENSIONS || 'env,json,txt,yaml,yml,config,js,ts,py,csv')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      allowedContentTypes: String(env.GRAYHAT_ALLOWED_CONTENT_TYPES || 'text/plain,application/json,text/yaml,application/x-yaml,text/x-python,application/javascript,text/javascript,text/csv')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      safety: sourceSafety(env, 'GRAYHAT', { minDelayMs: 400, maxErrors: 4, cooldownOnErrorMs: 1500 }),
    },
    gitlab: {
      enabled: toBool(env.GITLAB_ENABLED, false),
      token: String(env.GITLAB_TOKEN || '').trim(),
      baseUrl: String(env.GITLAB_BASE_URL || 'https://gitlab.com').trim().replace(/\/+$/, ''),
      maxQueries: toInt(env.GITLAB_MAX_QUERIES, 8),
      timeoutMs: toInt(env.GITLAB_TIMEOUT_MS, 15000),
      userAgent: String(env.GITLAB_USER_AGENT || 'credential-hunter/0.1').trim(),
      useSnippetExtraction: toBool(env.GITLAB_EXTRACT_SNIPPETS, true),
      safety: sourceSafety(env, 'GITLAB', { minDelayMs: 300, maxErrors: 5, cooldownOnErrorMs: 1200 }),
    },
    gist: {
      enabled: toBool(env.GIST_ENABLED, false),
      maxQueries: toInt(env.GIST_MAX_QUERIES, 8),
      timeoutMs: toInt(env.GIST_TIMEOUT_MS, 15000),
      userAgent: String(env.GIST_USER_AGENT || 'credential-hunter/0.1').trim(),
      fetchContent: toBool(env.GIST_FETCH_CONTENT, true),
      maxContentGists: toInt(env.GIST_MAX_CONTENT_GISTS, 8),
      safety: sourceSafety(env, 'GIST', { minDelayMs: 300, maxErrors: 5, cooldownOnErrorMs: 1200 }),
    },
    webtext: {
      enabled: toBool(env.WEBTEXT_ENABLED, false),
      urls: toList(env.WEBTEXT_URLS),
      timeoutMs: toInt(env.WEBTEXT_TIMEOUT_MS, 15000),
      userAgent: String(env.WEBTEXT_USER_AGENT || 'credential-hunter/0.1').trim(),
      maxUrls: toInt(env.WEBTEXT_MAX_URLS, 12),
      safety: sourceSafety(env, 'WEBTEXT', { minDelayMs: 200, maxErrors: 4, cooldownOnErrorMs: 1000 }),
    },
  };
}

module.exports = {
  getHunterSourceConfig,
};
