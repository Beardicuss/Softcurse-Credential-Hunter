function buildGrayhatQueries(queryPacks = [], options = {}) {
  const {
    maxKeywordsPerPack = 2,
    extensionJoin = ',',
  } = options;

  const queries = [];
  for (const pack of queryPacks) {
    const provider = String(pack?.provider || '').trim();
    const keywords = Array.isArray(pack?.keywords) ? pack.keywords.filter(Boolean).slice(0, maxKeywordsPerPack) : [];
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
  return queries;
}

module.exports = {
  buildGrayhatQueries,
};
