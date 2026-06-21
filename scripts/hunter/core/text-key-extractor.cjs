const { KEY_PATTERNS, GENERIC_SECRET_ASSIGNMENTS, FALSE_POSITIVE_PATTERNS } = require('./provider-patterns.cjs');
const { createSourceRecord } = require('./source-record.cjs');
const { scoreSourceRecord } = require('./scoring.cjs');
const { dedupeRecords } = require('./dedupe.cjs');
const { deriveProviderFromVariable } = require('./provider-hints.cjs');

function calculateShannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const charCounts = {};
  for (const char of str) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  let entropy = 0;
  const totalChars = str.length;
  for (const char in charCounts) {
    const probability = charCounts[char] / totalChars;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function buildBaseRecord(input = {}) {
  const record = createSourceRecord(input);
  record.confidence = scoreSourceRecord(record);
  return record;
}

function shouldSkipValue(value, minEntropy) {
  const isFalsePositive = FALSE_POSITIVE_PATTERNS.some((fp) => fp.test(value));
  const entropy = calculateShannonEntropy(value);
  if (isFalsePositive || entropy < minEntropy) return { skip: true, entropy };
  return { skip: false, entropy };
}

function extractKnownPatternKeys(content, lineNumber, context = {}) {
  const found = [];
  const minEntropy = Number(context.minEntropy || 3.5);

  for (const { provider, re } of KEY_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const value = match[1] ?? match[0];
      const verdict = shouldSkipValue(value, minEntropy);
      if (verdict.skip) continue;

      found.push(buildBaseRecord({
        provider,
        value,
        line: lineNumber,
        lineContent: content,
        entropy: verdict.entropy,
        source: context.source || 'text',
        sourceType: context.sourceType || 'text',
        sourceUrl: context.sourceUrl || null,
        repo: context.repo || null,
        query: context.query || null,
        evidence: Array.isArray(context.evidence) ? context.evidence : [context.sourceUrl || null].filter(Boolean),
        discoveredAt: context.discoveredAt || new Date().toISOString(),
        matchStrength: 'known-pattern',
        metadata: {
          ...(context.metadata || {}),
          matchStrength: 'known-pattern',
        },
      }));
    }
  }

  return found;
}

function extractGenericHintedKeys(content, lineNumber, context = {}) {
  const found = [];
  const minEntropy = Number(context.minEntropy || 3.8);

  for (const re of GENERIC_SECRET_ASSIGNMENTS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const variableName = match[1] || '';
      const value = match[2] || '';
      const verdict = shouldSkipValue(value, minEntropy);
      if (verdict.skip) continue;

      const derivedProvider = deriveProviderFromVariable(variableName) || 'Generic Secret';
      found.push(buildBaseRecord({
        provider: derivedProvider,
        value,
        line: lineNumber,
        lineContent: content,
        entropy: verdict.entropy,
        source: context.source || 'text',
        sourceType: context.sourceType || 'text',
        sourceUrl: context.sourceUrl || null,
        repo: context.repo || null,
        query: context.query || null,
        evidence: Array.isArray(context.evidence) ? context.evidence : [context.sourceUrl || null].filter(Boolean),
        discoveredAt: context.discoveredAt || new Date().toISOString(),
        matchStrength: 'generic-hint',
        metadata: {
          ...(context.metadata || {}),
          hintVariable: variableName,
          extractionMode: 'generic-hint',
          matchStrength: 'generic-hint',
        },
      }));
    }
  }

  return found;
}

function extractKeysFromText(text, context = {}) {
  const found = [];
  const lines = String(text || '').split('\n');
  const addedOnly = context.addedOnly === true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (addedOnly && (!line.startsWith('+') || line.startsWith('+++'))) continue;
    const content = addedOnly ? line.substring(1) : line;
    const lineNumber = i + 1;

    const knownMatches = extractKnownPatternKeys(content, lineNumber, context);
    const genericMatches = extractGenericHintedKeys(content, lineNumber, context)
      .filter((candidate) => !knownMatches.some((known) => known.valueText === candidate.valueText));

    found.push(...knownMatches);
    found.push(...genericMatches);
  }

  return dedupeRecords(found);
}

module.exports = {
  calculateShannonEntropy,
  extractKeysFromText,
  extractKnownPatternKeys,
  extractGenericHintedKeys,
};
