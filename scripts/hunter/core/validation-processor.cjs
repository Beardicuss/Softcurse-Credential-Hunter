const { buildCandidatePairs, shouldSuppressPairPart } = require('./candidate-pairing.cjs');
const { dedupeRecords } = require('./dedupe.cjs');
const { rankValidationCandidates, summarizeValidationPlan } = require('./validation-priority.cjs');
const { assessValidationCandidate } = require('./validation-stages.cjs');
const { buildFreshnessMeta } = require('./freshness.cjs');

async function processVerificationResults(options) {
  const {
    verificationResults,
    summary,
    generatedAt,
    checkKeyValidity,
    runLimited,
    concurrencyLimit = 5,
    logger = console,
  } = options;
  const confirmed = [];

  for (const { commit, keys } of verificationResults) {
    if (!keys.length) continue;
    logger.log(`  [FOUND] ${String(commit.sha).slice(0, 8)} - ${keys.length} key(s) [${commit.repo_owner}/${commit.repo_name}]`);

    const pairing = buildCandidatePairs(keys, commit);
    const candidates = rankValidationCandidates(dedupeRecords([...dedupeRecords(keys), ...pairing.pairs]));
    const plan = summarizeValidationPlan(candidates);
    logger.log(`    Validation priority -> high: ${plan.high}, medium: ${plan.medium}, low: ${plan.low}`);

    const staged = candidates.map((candidate) => {
      const decision = assessValidationCandidate(candidate);
      return Object.assign(candidate, {
        validationStage: decision.validationStage,
        validationStatus: decision.validationStatus,
        validationReason: decision.reason,
      });
    });
    const probeCandidates = staged.filter((candidate) => candidate.validationStage === 'probe');
    const skippedCandidates = staged.filter((candidate) => candidate.validationStage !== 'probe');
    logger.log(`    Validation stages -> probe: ${probeCandidates.length}, preflight-only: ${skippedCandidates.length}`);

    const probed = await runLimited(async (candidate) => {
      const validity = await checkKeyValidity(candidate.provider, candidate.value);
      return Object.assign(candidate, { validity, validationStatus: validity });
    }, concurrencyLimit, probeCandidates);
    const retained = [...probed, ...skippedCandidates]
      .filter((candidate) => !shouldSuppressPairPart(candidate.provider, pairing.active));

    for (const candidate of retained) incrementValidationSummary(summary, candidate);
    ensureProviderSummary(summary, commit.provider).confirmed += 1;
    confirmed.push({
      ...commit,
      leaked_keys: retained.map((candidate) => projectLeakedKey(candidate, generatedAt)),
    });
  }

  return confirmed;
}

function ensureProviderSummary(summary, provider) {
  const name = provider || 'Unknown';
  if (!summary[name]) summary[name] = { candidates: 0, confirmed: 0, valid: 0, invalid: 0, unknown: 0 };
  return summary[name];
}

function incrementValidationSummary(summary, candidate) {
  const stats = ensureProviderSummary(summary, candidate.provider);
  if (candidate.validity === 'valid') stats.valid += 1;
  else if (candidate.validity === 'invalid') stats.invalid += 1;
  else stats.unknown += 1;
}

function maskCandidate(candidate) {
  if (candidate.provider === 'AWS Pair' || candidate.provider === 'Azure Pair') return `${String(candidate.value.id).slice(0, 8)}...`;
  if (candidate.provider === 'Twilio Pair') return `${String(candidate.value.sid).slice(0, 8)}...`;
  const value = String(candidate.value);
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function projectLeakedKey(candidate, generatedAt) {
  const freshness = buildFreshnessMeta(candidate, generatedAt);
  return {
    provider: candidate.provider,
    value_masked: maskCandidate(candidate),
    value_full: candidate.value,
    validity: candidate.validity,
    validationStatus: candidate.validationStatus || candidate.validity || 'unknown',
    validationReason: candidate.validationReason || null,
    line: candidate.line,
    lineContent: candidate.lineContent,
    entropy: candidate.entropy,
    confidence: candidate.confidence,
    matchStrength: candidate.matchStrength || candidate.metadata?.matchStrength || 'unknown',
    validationTier: candidate.validationTier || 'unknown',
    discoveredAt: freshness.discoveredAt,
    lastValidatedAt: freshness.lastValidatedAt,
    ageMs: freshness.ageMs,
    validationAgeMs: freshness.validationAgeMs,
    freshness: freshness.freshness,
    revalidationSuggested: freshness.revalidationSuggested,
  };
}

module.exports = { processVerificationResults, projectLeakedKey };
