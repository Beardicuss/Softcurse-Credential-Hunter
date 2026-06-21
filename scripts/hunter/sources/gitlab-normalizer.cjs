function normalizeGitLabResults(payload, searchContext = {}, options = {}) {
  const baseUrl = String(options.baseUrl || 'https://gitlab.com').replace(/\/+$/, '');
  const items = Array.isArray(payload) ? payload : [];

  return items.map((item, index) => {
    const path = String(item.path || item.filename || '').trim();
    const projectPath = String(item.project_path || item.path_with_namespace || '').trim();
    const ref = String(item.ref || item.branch_name || 'HEAD').trim() || 'HEAD';
    const sourceUrl = projectPath && path
      ? `${baseUrl}/${projectPath}/-/blob/${encodeURIComponent(ref).replace(/%2F/g, '/')}/${path.split('/').map((part) => encodeURIComponent(part)).join('/')}`
      : null;

    return {
      source: 'gitlab',
      sourceType: 'blob',
      provider: searchContext.provider || 'GitLab',
      query: searchContext.query || null,
      sha: item.commit_id || `${projectPath || 'project'}:${path || index}:${ref}`,
      commit_url: sourceUrl,
      author_date: item.created_at || item.last_activity_at || new Date().toISOString(),
      message: item.basename || item.filename || path || null,
      author: item.author?.username || item.author?.name || null,
      repo_owner: projectPath.includes('/') ? projectPath.split('/')[0] : null,
      repo_name: projectPath.includes('/') ? projectPath.split('/').slice(1).join('/') : projectPath || null,
      repo_url: projectPath ? `${baseUrl}/${projectPath}` : null,
      verification_status: null,
      snippet: typeof item.data === 'string' ? item.data : '',
      file_path: path || null,
      ref,
      project_path: projectPath || null,
      source_url: sourceUrl,
      metadata: {
        filename: item.filename || null,
        basename: item.basename || null,
        project_id: item.project_id || null,
        startline: item.startline || null,
      },
    };
  });
}

module.exports = {
  normalizeGitLabResults,
};
