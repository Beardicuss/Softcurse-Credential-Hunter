const { scoreSourceRecord } = require('./scoring.cjs');

function buildCandidatePairs(keys, commit, now = () => new Date().toISOString()) {
  const awsIds = keys.filter((key) => key.provider === 'AWS');
  const awsSecrets = keys.filter((key) => key.provider === 'AWS Secret');
  const azureIds = keys.filter((key) => key.provider === 'Azure Client ID');
  const azureSecrets = keys.filter((key) => key.provider === 'Azure Client Secret');
  const azureTenants = keys.filter((key) => key.provider === 'Azure Tenant ID');
  const twilioSids = keys.filter((key) => key.provider === 'Twilio SID');
  const twilioTokens = keys.filter((key) => ['Twilio Token', 'Twilio Bare Token'].includes(key.provider));
  const pairs = [];

  for (const id of awsIds) for (const secret of awsSecrets) {
    pairs.push(createPair('AWS Pair', id, secret, commit, {
      value: { id: id.value, secret: secret.value },
      lineContent: `ID: ${String(id.value).slice(0, 8)}... Secret: ...${String(secret.value).slice(-4)}`,
    }, now));
  }
  for (const id of azureIds) for (const secret of azureSecrets) {
    const tenantRecord = azureTenants[0];
    const tenant = tenantRecord?.value || 'common';
    pairs.push(createPair('Azure Pair', id, secret, commit, {
      value: { id: id.value, secret: secret.value, tenant },
      lineContent: `ID: ${String(id.value).slice(0, 8)}... Secret: ...${String(secret.value).slice(-4)}`,
      extraEvidence: tenantRecord?.evidence || [],
    }, now));
  }
  for (const sid of twilioSids) for (const token of twilioTokens) {
    pairs.push(createPair('Twilio Pair', sid, token, commit, {
      value: { sid: sid.value, token: token.value },
      lineContent: `SID: ${String(sid.value).slice(0, 8)}... Token: ...${String(token.value).slice(-4)}`,
    }, now));
  }

  return {
    pairs,
    active: {
      aws: awsIds.length > 0 && awsSecrets.length > 0,
      azure: azureIds.length > 0 && azureSecrets.length > 0,
      twilio: twilioSids.length > 0 && twilioTokens.length > 0,
    },
  };
}

function createPair(provider, first, second, commit, options, now) {
  const record = {
    provider,
    value: options.value,
    valueText: JSON.stringify(options.value),
    line: first.line,
    lineContent: options.lineContent,
    entropy: (first.entropy + second.entropy) / 2,
    source: first.source || commit.source || 'derived',
    sourceType: first.sourceType || 'paired-secret',
    sourceUrl: first.sourceUrl || commit.commit_url || null,
    repo: commit,
    query: first.query || commit.query || null,
    evidence: Array.from(new Set([...(first.evidence || []), ...(second.evidence || []), ...(options.extraEvidence || [])])),
    discoveredAt: first.discoveredAt || commit.author_date || now(),
    matchStrength: 'paired-secret',
    metadata: { matchStrength: 'paired-secret' },
  };
  record.confidence = scoreSourceRecord(record);
  return record;
}

function shouldSuppressPairPart(provider, activePairs) {
  if (provider.startsWith('AWS') && activePairs.aws) return provider !== 'AWS Pair';
  if (provider.startsWith('Azure') && activePairs.azure) return provider !== 'Azure Pair';
  if (provider.startsWith('Twilio') && activePairs.twilio) return provider !== 'Twilio Pair';
  return false;
}

module.exports = { buildCandidatePairs, shouldSuppressPairPart };
