const NOISY_PREFIXES = new Set([
  'API',
  'APP',
  'AUTH',
  'CLIENT',
  'CLOUD',
  'DEFAULT',
  'DEV',
  'INTERNAL',
  'LIVE',
  'LOCAL',
  'PRIVATE',
  'PROD',
  'PUBLIC',
  'SERVICE',
  'STAGING',
  'SYSTEM',
  'TEST',
  'USER',
]);

const NOISY_SUFFIXES = [
  'API_KEY',
  'ACCESS_KEY',
  'ACCESS_TOKEN',
  'AUTH_TOKEN',
  'BEARER_TOKEN',
  'CLIENT_ID',
  'CLIENT_SECRET',
  'SECRET_KEY',
  'PRIVATE_KEY',
  'API_SECRET',
  'TOKEN',
  'SECRET',
  'KEY',
  'ID',
];

function toTitleCase(word) {
  const lower = String(word || '').toLowerCase();
  return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : '';
}

function deriveProviderFromVariable(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;

  let normalized = raw
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  for (const suffix of NOISY_SUFFIXES) {
    if (normalized.endsWith(`_${suffix}`)) {
      normalized = normalized.slice(0, -(`_${suffix}`.length));
      break;
    }
    if (normalized === suffix) {
      normalized = '';
      break;
    }
  }

  const parts = normalized
    .split('_')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !NOISY_PREFIXES.has(part));

  if (parts.length === 0) return null;
  if (parts.length === 1 && parts[0].length < 3) return null;

  return parts.map(toTitleCase).join(' ');
}

module.exports = {
  deriveProviderFromVariable,
};
