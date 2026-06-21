function dedupeRecords(records = []) {
  const seen = new Map();

  for (const record of records) {
    const key = record.fingerprint || `${record.provider || ''}::${record.valueText || ''}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        ...record,
        evidence: Array.isArray(record.evidence) ? [...record.evidence] : [],
      });
      continue;
    }

    existing.confidence = Math.max(Number(existing.confidence || 0), Number(record.confidence || 0));
    existing.entropy = Math.max(Number(existing.entropy || 0), Number(record.entropy || 0));
    existing.validity = existing.validity === 'valid' ? 'valid' : (record.validity || existing.validity);
    existing.evidence = mergeEvidence(existing.evidence, record.evidence);
    if (!existing.sourceUrl && record.sourceUrl) existing.sourceUrl = record.sourceUrl;
    if (!existing.lineContent && record.lineContent) existing.lineContent = record.lineContent;
    if (matchStrengthWeight(record) > matchStrengthWeight(existing)) {
      existing.matchStrength = record.matchStrength || record.metadata?.matchStrength || existing.matchStrength;
      existing.metadata = { ...(existing.metadata || {}), ...(record.metadata || {}) };
      if (record.provider) existing.provider = record.provider;
    }
  }

  return Array.from(seen.values());
}

function matchStrengthWeight(record = {}) {
  const matchStrength = String(record.matchStrength || record.metadata?.matchStrength || 'unknown').toLowerCase();
  if (matchStrength === 'paired-secret') return 4;
  if (matchStrength === 'known-pattern') return 3;
  if (matchStrength === 'derived') return 2;
  if (matchStrength === 'generic-hint') return 1;
  return 0;
}

function mergeEvidence(a = [], b = []) {
  const items = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]
    .filter(Boolean);
  return Array.from(new Set(items));
}

module.exports = {
  dedupeRecords,
};
