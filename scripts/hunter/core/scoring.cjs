function scoreSourceRecord(record = {}) {
  let score = 0;

  if (record.entropy >= 4.8) score += 0.35;
  else if (record.entropy >= 4.3) score += 0.25;
  else if (record.entropy >= 3.8) score += 0.15;
  else if (record.entropy >= 3.5) score += 0.08;

  const source = String(record.source || '').toLowerCase();
  const sourceType = String(record.sourceType || '').toLowerCase();
  const matchStrength = String(record.matchStrength || record.metadata?.matchStrength || '').toLowerCase();
  const provider = String(record.provider || '').toLowerCase();
  const evidenceCount = Array.isArray(record.evidence) ? record.evidence.length : 0;

  if (source === 'github') score += 0.12;
  else if (source === 'gitlab') score += 0.1;
  else if (source === 'grayhat') score += 0.09;
  else if (source === 'gist') score += 0.08;

  if (sourceType === 'commit') score += 0.12;
  else if (sourceType === 'blob-snippet' || sourceType === 'gist-page') score += 0.09;
  else if (sourceType === 'text') score += 0.04;

  if (matchStrength === 'known-pattern') score += 0.22;
  else if (matchStrength === 'paired-secret') score += 0.24;
  else if (matchStrength === 'generic-hint') score += 0.07;
  else if (matchStrength === 'derived') score += 0.05;

  if (record.lineContent) score += 0.05;
  if (record.query) score += 0.05;
  if (record.sourceUrl) score += 0.04;
  if (evidenceCount >= 2) score += 0.05;
  else if (evidenceCount === 1) score += 0.02;

  if (/openai|anthropic|gemini|xai|grok|openrouter|mistral|cohere|stripe|aws|azure|github|twilio/.test(provider)) {
    score += 0.1;
  }
  if (provider === 'generic secret') {
    score -= 0.06;
  }

  return Number(Math.max(0, Math.min(1, score)).toFixed(3));
}

module.exports = {
  scoreSourceRecord,
};
