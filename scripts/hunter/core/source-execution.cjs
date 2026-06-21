function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function isPermanentError(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  const code = String(error?.code || '').toUpperCase();
  return [400, 401, 403, 404, 422].includes(status)
    || ['EAUTH', 'EACCES', 'ERR_INVALID_ARG_VALUE'].includes(code);
}

function sanitizeError(error) {
  const message = String(error?.message || error || 'Unknown source failure')
    .replace(/([?&](?:key|token|secret|authorization)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(?:sk|gsk|ghp|glpat|xoxb|AKIA)[-_A-Za-z0-9]{12,}\b/g, '[REDACTED]');
  return message.slice(0, 300);
}

async function runWithRetry(operation, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 1));
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs || 500));
  const sleep = options.sleep || delay;
  let lastError;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      return { value: await operation(attempt), attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || isPermanentError(error)) break;
      await sleep(baseDelayMs * (2 ** (attempt - 1)));
    }
  }

  const wrapped = new Error(sanitizeError(lastError));
  wrapped.cause = lastError;
  wrapped.attempts = attempts;
  throw wrapped;
}

module.exports = {
  isPermanentError,
  runWithRetry,
  sanitizeError,
};