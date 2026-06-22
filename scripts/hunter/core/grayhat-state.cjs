const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STATE = {
  version: 1,
  queryOffset: 0,
  seenFingerprints: [],
  updatedAt: null,
};

function loadGrayhatState(filePath, fileSystem = fs) {
  try {
    if (!filePath || !fileSystem.existsSync(filePath)) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(fileSystem.readFileSync(filePath, 'utf8'));
    return {
      version: 1,
      queryOffset: Math.max(0, Number(parsed.queryOffset || 0)),
      seenFingerprints: Array.isArray(parsed.seenFingerprints)
        ? parsed.seenFingerprints.filter((item) => typeof item === 'string').slice(-5000)
        : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveGrayhatState(filePath, state, fileSystem = fs) {
  if (!filePath) return;
  fileSystem.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + '.' + process.pid + '.tmp';
  const payload = {
    version: 1,
    queryOffset: Math.max(0, Number(state?.queryOffset || 0)),
    seenFingerprints: Array.from(new Set(state?.seenFingerprints || [])).slice(-5000),
    updatedAt: new Date().toISOString(),
  };
  fileSystem.writeFileSync(temporaryPath, JSON.stringify(payload, null, 2), 'utf8');
  fileSystem.renameSync(temporaryPath, filePath);
}

module.exports = { DEFAULT_STATE, loadGrayhatState, saveGrayhatState };
