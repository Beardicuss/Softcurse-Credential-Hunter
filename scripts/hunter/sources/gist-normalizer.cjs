function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(text) {
  return decodeHtml(String(text || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeGistSearchResults(html, searchContext = {}) {
  const results = [];
  const seen = new Set();
  const gistLinkRe = /href="(\/[^"\s]+\/[0-9a-f]{8,})"/ig;
  let match;

  while ((match = gistLinkRe.exec(String(html || ''))) !== null) {
    const relative = match[1] || '';
    const parts = relative.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const owner = parts[0];
    const gistId = parts[1];
    const key = `${owner}/${gistId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const url = `https://gist.github.com/${owner}/${gistId}`;
    results.push({
      source: 'gist',
      sourceType: 'gist',
      provider: searchContext.provider || 'GitHub Gist',
      query: searchContext.query || null,
      sha: gistId,
      commit_url: url,
      author_date: new Date().toISOString(),
      message: `Gist candidate for ${searchContext.query || 'search'}`,
      author: owner,
      repo_owner: owner,
      repo_name: gistId,
      repo_url: url,
      verification_status: null,
      snippet: '',
      source_url: url,
      metadata: {
        gistId,
        owner,
      },
    });
  }

  return results;
}

function extractGistPageText(html) {
  const codeBlocks = [];
  const regexes = [
    /<table[^>]*highlight[^>]*>[\s\S]*?<\/table>/ig,
    /<div[^>]*blob-code-inner[^>]*>[\s\S]*?<\/div>/ig,
    /<td[^>]*blob-code[^>]*>[\s\S]*?<\/td>/ig,
  ];

  for (const re of regexes) {
    let match;
    while ((match = re.exec(String(html || ''))) !== null) {
      const cleaned = stripTags(match[0]);
      if (cleaned) codeBlocks.push(cleaned);
    }
  }

  if (codeBlocks.length > 0) {
    return codeBlocks.join('\n');
  }

  return stripTags(html);
}

module.exports = {
  normalizeGistSearchResults,
  extractGistPageText,
};
