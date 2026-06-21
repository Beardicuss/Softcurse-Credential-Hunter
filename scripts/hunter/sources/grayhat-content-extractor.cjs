const { extractKeysFromText } = require('../core/text-key-extractor.cjs');
const { dedupeRecords } = require('../core/dedupe.cjs');
const { fetchGrayhatFile } = require('./grayhat-client.cjs');

function isFetchableGrayhatRecord(record, options = {}) {
  const allowedExtensions = Array.isArray(options.allowedExtensions) ? options.allowedExtensions : [];
  const allowedContentTypes = Array.isArray(options.allowedContentTypes) ? options.allowedContentTypes : [];
  const maxBytes = Number(options.maxBytes || 262144);
  const meta = record?.metadata || {};
  const extension = String(meta.extension || '').trim().toLowerCase();
  const contentType = String(meta.contentType || '').trim().toLowerCase();
  const size = Number(meta.size || 0) || 0;

  if (!record?.sourceUrl) return { ok: false, reason: 'missing_url' };
  if (size > 0 && size > maxBytes) return { ok: false, reason: 'too_large' };
  if (allowedExtensions.length > 0 && extension && !allowedExtensions.includes(extension)) {
    return { ok: false, reason: 'extension_filtered' };
  }
  if (allowedContentTypes.length > 0 && contentType && !allowedContentTypes.some((item) => contentType.includes(item))) {
    return { ok: false, reason: 'content_type_filtered' };
  }
  return { ok: true };
}

async function extractGrayhatFileKeys(record, options = {}) {
  const fetchable = isFetchableGrayhatRecord(record, options);
  if (!fetchable.ok) return [];

  try {
    const response = await fetchGrayhatFile(record.sourceUrl, options);
    if (!response || response.statusCode < 200 || response.statusCode >= 300) return [];

    const headerType = String(response.headers?.['content-type'] || '').trim().toLowerCase();
    if (Array.isArray(options.allowedContentTypes) && options.allowedContentTypes.length > 0 && headerType) {
      const matches = options.allowedContentTypes.some((item) => headerType.includes(item));
      if (!matches) return [];
    }

    const extracted = extractKeysFromText(response.body || '', {
      source: 'grayhat',
      sourceType: 'bucket-file-content',
      sourceUrl: record.sourceUrl,
      query: record.query,
      discoveredAt: record.discoveredAt,
      evidence: Array.isArray(record.evidence) ? record.evidence : [],
      metadata: {
        ...(record.metadata || {}),
        extractedFrom: record.sourceUrl,
        fetchedContentType: headerType || null,
        fetchedBytes: response.bytesRead || null,
        truncated: !!response.truncated,
      },
      minEntropy: 3.5,
      addedOnly: false,
    });
    return dedupeRecords(extracted);
  } catch (_) {
    return [];
  }
}

module.exports = {
  isFetchableGrayhatRecord,
  extractGrayhatFileKeys,
};
