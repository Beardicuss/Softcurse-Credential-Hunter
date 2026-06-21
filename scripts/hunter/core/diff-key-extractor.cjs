const { KEY_PATTERNS, FALSE_POSITIVE_PATTERNS } = require('./provider-patterns.cjs');
const { createSourceRecord } = require('./source-record.cjs');
const { scoreSourceRecord } = require('./scoring.cjs');

function calculateShannonEntropy(value) {
  const text = String(value || '');
  if (!text) return 0;
  const counts = new Map();
  for (const character of text) counts.set(character, (counts.get(character) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / text.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function matchesFalsePositive(value, patterns) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function createDiffKeyExtractor(options = {}) {
  const keyPatterns = options.keyPatterns || KEY_PATTERNS;
  const falsePositivePatterns = options.falsePositivePatterns || FALSE_POSITIVE_PATTERNS;
  const minimumEntropy = Number(options.minimumEntropy ?? 3.5);
  const createRecord = options.createRecord || createSourceRecord;
  const scoreRecord = options.scoreRecord || scoreSourceRecord;
  const now = options.now || (() => new Date().toISOString());

  return function extractKeysFromDiff(diff, context = {}) {
    const found = [];
    const lines = String(diff || '').split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      const lineContent = line.slice(1);

      for (const { provider, re } of keyPatterns) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(lineContent)) !== null) {
          const value = match[1] ?? match[0];
          const entropy = calculateShannonEntropy(value);
          if (!matchesFalsePositive(value, falsePositivePatterns) && entropy >= minimumEntropy) {
            const record = createRecord({
              provider,
              value,
              line: index + 1,
              lineContent,
              entropy,
              source: context.source || 'github',
              sourceType: context.sourceType || 'commit',
              sourceUrl: context.sourceUrl || null,
              repo: context.repo || null,
              query: context.query || null,
              evidence: [context.sourceUrl || context.repo?.repo_url || null].filter(Boolean),
              discoveredAt: context.discoveredAt || now(),
            });
            record.confidence = scoreRecord(record);
            found.push(record);
          }
          if (match[0] === '') re.lastIndex += 1;
        }
      }
    }

    return found;
  };
}

const extractKeysFromDiff = createDiffKeyExtractor();

module.exports = {
  calculateShannonEntropy,
  createDiffKeyExtractor,
  extractKeysFromDiff,
};
