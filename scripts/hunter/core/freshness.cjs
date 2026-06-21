function buildFreshnessMeta(record = {}, generatedAt = new Date().toISOString()) {
  const discoveredAt = normalizeDate(record.discoveredAt) || normalizeDate(generatedAt);
  const lastValidatedAt = normalizeDate(record.lastValidatedAt) || normalizeDate(generatedAt);
  const ageMs = Math.max(0, new Date(generatedAt).getTime() - new Date(discoveredAt).getTime());
  const validationAgeMs = Math.max(0, new Date(generatedAt).getTime() - new Date(lastValidatedAt).getTime());

  return {
    discoveredAt,
    lastValidatedAt,
    ageMs,
    validationAgeMs,
    freshness: classifyFreshness(validationAgeMs),
    revalidationSuggested: shouldRevalidate(record, validationAgeMs),
  };
}

function classifyFreshness(validationAgeMs) {
  if (validationAgeMs <= 6 * 60 * 60 * 1000) return 'fresh';
  if (validationAgeMs <= 24 * 60 * 60 * 1000) return 'warm';
  return 'stale';
}

function shouldRevalidate(record = {}, validationAgeMs = 0) {
  const validity = String(record.validity || '').toLowerCase();
  const matchStrength = String(record.matchStrength || record.metadata?.matchStrength || '').toLowerCase();

  if (validity === 'valid' && validationAgeMs > 24 * 60 * 60 * 1000) return true;
  if (validity === 'unknown' && validationAgeMs > 6 * 60 * 60 * 1000) return true;
  if (matchStrength === 'paired-secret' && validationAgeMs > 12 * 60 * 60 * 1000) return true;
  return false;
}

function normalizeDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

module.exports = {
  buildFreshnessMeta,
};
