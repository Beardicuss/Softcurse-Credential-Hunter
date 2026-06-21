function createSourceGuard(config = {}) {
  const {
    logger = console,
    source = 'source',
    minDelayMs = 0,
    maxErrors = 5,
    cooldownOnErrorMs = 0,
  } = config;

  let errorCount = 0;
  let requestCount = 0;

  async function beforeRequest() {
    if (requestCount > 0 && minDelayMs > 0) {
      await delay(minDelayMs);
    }
    requestCount += 1;
  }

  async function onError(error, context = {}) {
    errorCount += 1;
    if (cooldownOnErrorMs > 0) {
      logger?.log?.(`  · ${source} cooldown ${cooldownOnErrorMs}ms after error${context?.label ? ` (${context.label})` : ''}.`);
      await delay(cooldownOnErrorMs);
    }
  }

  function shouldStop() {
    return errorCount >= Math.max(1, Number(maxErrors || 1));
  }

  function getState() {
    return { errorCount, requestCount, maxErrors };
  }

  return {
    beforeRequest,
    onError,
    shouldStop,
    getState,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

module.exports = {
  createSourceGuard,
};
