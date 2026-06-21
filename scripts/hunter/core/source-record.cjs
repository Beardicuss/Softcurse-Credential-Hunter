function fingerprintValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function createSourceRecord(input = {}) {
  const provider = String(input.provider || '').trim();
  const value = input.value;
  const valueText = typeof value === 'string'
    ? value
    : JSON.stringify(value || null);
  const source = String(input.source || 'github').trim() || 'github';
  const sourceType = String(input.sourceType || 'commit').trim() || 'commit';
  const sourceUrl = String(input.sourceUrl || '').trim() || null;
  const repo = input.repo || null;
  const query = String(input.query || '').trim() || null;
  const evidence = Array.isArray(input.evidence) ? input.evidence.filter(Boolean) : [];
  const metadata = input.metadata || {};
  const fingerprint = input.fingerprint || `${provider}::${source}::${fingerprintValue(valueText)}`;

  return {
    provider,
    value,
    valueText,
    source,
    sourceType,
    sourceUrl,
    repo,
    query,
    line: Number(input.line || 0) || null,
    lineContent: input.lineContent || null,
    entropy: Number(input.entropy || 0),
    validity: input.validity || 'unknown',
    discoveredAt: input.discoveredAt || new Date().toISOString(),
    confidence: Number(input.confidence || 0),
    evidence,
    fingerprint,
    metadata,
    matchStrength: String(input.matchStrength || metadata.matchStrength || 'unknown').trim() || 'unknown',
  };
}

module.exports = {
  createSourceRecord,
  fingerprintValue,
};
