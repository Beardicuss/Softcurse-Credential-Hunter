const MATCH_STRENGTH_WEIGHT = {
  'paired-secret': 4,
  'known-pattern': 3,
  'derived': 2,
  'generic-hint': 1,
  'unknown': 0,
};

function getMatchStrengthWeight(record = {}) {
  const matchStrength = String(record.matchStrength || record.metadata?.matchStrength || 'unknown').toLowerCase();
  return MATCH_STRENGTH_WEIGHT[matchStrength] ?? 0;
}

function getValidationTier(record = {}) {
  const confidence = Number(record.confidence || 0);
  const matchStrength = String(record.matchStrength || record.metadata?.matchStrength || 'unknown').toLowerCase();

  if (matchStrength === 'paired-secret' || confidence >= 0.7) return 'high';
  if (matchStrength === 'known-pattern' || confidence >= 0.5) return 'medium';
  return 'low';
}

function rankValidationCandidates(records = []) {
  return [...records]
    .map((record, index) => ({
      ...record,
      validationTier: getValidationTier(record),
      _order: index,
    }))
    .sort((a, b) => {
      const tierDelta = tierWeight(b.validationTier) - tierWeight(a.validationTier);
      if (tierDelta !== 0) return tierDelta;

      const confidenceDelta = Number(b.confidence || 0) - Number(a.confidence || 0);
      if (confidenceDelta !== 0) return confidenceDelta;

      const strengthDelta = getMatchStrengthWeight(b) - getMatchStrengthWeight(a);
      if (strengthDelta !== 0) return strengthDelta;

      const entropyDelta = Number(b.entropy || 0) - Number(a.entropy || 0);
      if (entropyDelta !== 0) return entropyDelta;

      return a._order - b._order;
    })
    .map(({ _order, ...record }) => record);
}

function summarizeValidationPlan(records = []) {
  return records.reduce((acc, record) => {
    const tier = record.validationTier || getValidationTier(record);
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });
}

function tierWeight(tier) {
  if (tier === 'high') return 3;
  if (tier === 'medium') return 2;
  return 1;
}

module.exports = {
  getValidationTier,
  rankValidationCandidates,
  summarizeValidationPlan,
};
