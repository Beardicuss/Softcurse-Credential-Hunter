function buildGrayhatQueries(queryPacks = [], options = {}) {
  const maxKeywordsPerPack = Number(options.maxKeywordsPerPack || 2);
  const extensionJoin = options.extensionJoin || ',';
  const queries = [];

  for (const pack of queryPacks) {
    const provider = String(pack?.provider || '').trim();
    const keywords = Array.isArray(pack?.keywords)
      ? pack.keywords.filter(Boolean).slice(0, maxKeywordsPerPack)
      : [];
    const extensions = Array.isArray(pack?.extensions) ? pack.extensions.filter(Boolean) : [];
    for (const keyword of keywords) {
      queries.push({
        provider,
        keyword,
        extensions,
        extensionQuery: extensions.join(extensionJoin),
      });
    }
  }

  return rotateQueries(queries, Number(options.offset || 0), options.limit);
}

function rotateQueries(queries, offset = 0, limit = queries.length) {
  if (!Array.isArray(queries) || queries.length === 0) return [];
  const start = ((offset % queries.length) + queries.length) % queries.length;
  const count = Math.min(queries.length, Math.max(0, Number(limit ?? queries.length)));
  return Array.from({ length: count }, (_, index) => queries[(start + index) % queries.length]);
}

module.exports = { buildGrayhatQueries, rotateQueries };
