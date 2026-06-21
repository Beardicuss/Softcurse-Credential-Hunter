function normalizeWebTextSeeds(urls = []) {
  const seen = new Set();
  const records = [];

  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);

    records.push({
      source: 'webtext',
      sourceType: 'seed-url',
      provider: 'Web Text',
      query: null,
      sha: url,
      commit_url: url,
      author_date: new Date().toISOString(),
      message: `Seed URL ${url}`,
      author: null,
      repo_owner: null,
      repo_name: url,
      repo_url: url,
      verification_status: null,
      source_url: url,
      metadata: {
        seedUrl: url,
      },
    });
  }

  return records;
}

function extractWebTextBody(body, headers = {}) {
  const contentType = String(headers['content-type'] || '').toLowerCase();
  const text = String(body || '');

  if (contentType.includes('html')) {
    return text
      .replace(/<script[\s\S]*?<\/script>/ig, ' ')
      .replace(/<style[\s\S]*?<\/style>/ig, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  return text;
}

module.exports = {
  normalizeWebTextSeeds,
  extractWebTextBody,
};
