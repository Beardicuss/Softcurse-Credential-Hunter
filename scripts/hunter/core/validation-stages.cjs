const PROBE_CAPABLE_PROVIDERS = new Set([
  'Anthropic',
  'OpenAI',
  'xAI / Grok',
  'Google Gemini',
  'Mistral',
  'Cohere',
  'Hugging Face',
  'Together AI',
  'Replicate',
  'Stripe',
  'GitHub PAT',
  'AWS Pair',
  'Azure Pair',
  'Twilio Pair',
]);

function assessValidationCandidate(record = {}) {
  const provider = String(record.provider || '').trim();
  const confidence = Number(record.confidence || 0);
  const matchStrength = String(record.matchStrength || record.metadata?.matchStrength || 'unknown').toLowerCase();
  const value = record.value;

  if (!provider) {
    return buildDecision('preflight', 'invalid_preflight', false, 'missing_provider');
  }

  if (provider === 'AWS' || provider === 'AWS Secret') {
    return buildDecision('preflight', 'waiting_for_pair', false, 'needs_pairing');
  }
  if (provider === 'Azure Client ID' || provider === 'Azure Client Secret' || provider === 'Azure Tenant ID') {
    return buildDecision('preflight', 'waiting_for_pair', false, 'needs_full_azure_pair');
  }
  if (provider === 'Twilio SID' || provider === 'Twilio Token' || provider === 'Twilio Bare Token') {
    return buildDecision('preflight', 'waiting_for_pair', false, 'needs_twilio_pair');
  }

  if (provider === 'Generic Secret' && confidence < 0.5) {
    return buildDecision('preflight', 'deferred_low_confidence', false, 'generic_low_confidence');
  }
  if (matchStrength === 'generic-hint' && confidence < 0.45) {
    return buildDecision('preflight', 'deferred_low_confidence', false, 'generic_hint_low_confidence');
  }

  if (!passesBasicFormat(provider, value)) {
    return buildDecision('preflight', 'failed_format', false, 'basic_format_failed');
  }

  if (!PROBE_CAPABLE_PROVIDERS.has(provider)) {
    return buildDecision('preflight', 'unsupported_probe', false, 'no_probe_handler');
  }

  return buildDecision('probe', 'ready_for_probe', true, 'probe_capable');
}

function passesBasicFormat(provider, value) {
  if (value == null) return false;

  if (provider === 'AWS Pair') {
    return !!value?.id && !!value?.secret;
  }
  if (provider === 'Azure Pair') {
    return !!value?.id && !!value?.secret && !!value?.tenant;
  }
  if (provider === 'Twilio Pair') {
    return !!value?.sid && !!value?.token;
  }

  const text = String(value || '').trim();
  if (!text) return false;
  if (text.length < 12) return false;

  return true;
}

function buildDecision(stage, status, shouldProbe, reason) {
  return {
    validationStage: stage,
    validationStatus: status,
    shouldProbe,
    reason,
  };
}

module.exports = {
  assessValidationCandidate,
};
