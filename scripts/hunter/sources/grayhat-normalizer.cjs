const { createSourceRecord } = require('../core/source-record.cjs');
const { scoreSourceRecord } = require('../core/scoring.cjs');

function getGrayhatItems(payload) {
  if (Array.isArray(payload?.files)) return payload.files;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.files)) return payload.data.files;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeGrayhatResults(payload, query) {
  const rawItems = getGrayhatItems(payload);

  return rawItems.map((item) => {
    const bucket = item.bucket || item.bucket_name || item.container || item.account || item.storage_account || '';
    const filePath = item.path || item.file || item.name || item.filename || item.key || '';
    const url = item.url || item.link || item.download_url || item.public_url || null;
    const size = Number(item.size || item.bytes || 0) || null;
    const extension = getFileExtension(filePath);
    const contentType = String(item.content_type || item.mime || '').trim().toLowerCase() || null;
    const lineContent = [bucket, filePath].filter(Boolean).join(' / ');

    const record = createSourceRecord({
      provider: query.provider,
      value: '',
      source: 'grayhat',
      sourceType: 'bucket-file',
      sourceUrl: url,
      query: query.keyword,
      lineContent,
      evidence: [url, bucket, filePath].filter(Boolean),
      discoveredAt: new Date().toISOString(),
      fingerprint: ['grayhat', query.provider, bucket, filePath].join('::').toLowerCase(),
      metadata: {
        bucket,
        filePath,
        size,
        extension,
        region: item.region || null,
        contentType,
        extensionQuery: query.extensionQuery || '',
      },
    });

    record.confidence = Math.max(0.15, scoreSourceRecord({
      ...record,
      lineContent,
      source: 'grayhat',
      sourceType: 'bucket-file',
      entropy: 0,
    }));

    return record;
  });
}

function getFileExtension(filePath) {
  const name = String(filePath || '').trim().toLowerCase();
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1) : '';
}

module.exports = {
  normalizeGrayhatResults,
  getGrayhatItems,
};
