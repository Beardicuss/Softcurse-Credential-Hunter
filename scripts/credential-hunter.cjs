const path = require("path");
const { SEARCH_QUERIES } = require("./hunter/core/provider-patterns.cjs");
const { dedupeRecords } = require("./hunter/core/dedupe.cjs");
const { collectSources, mergeSourceErrors, mergeSourceSummaries } = require("./hunter/core/source-orchestrator.cjs");
const { collectGitHubCandidates } = require("./hunter/sources/github-source.cjs");
const { createGitHubClient } = require("./hunter/sources/github-client.cjs");
const { collectGrayhatCandidates } = require("./hunter/sources/grayhat-source.cjs");
const { collectGitLabCandidates } = require("./hunter/sources/gitlab-source.cjs");
const { collectGistCandidates } = require("./hunter/sources/gist-source.cjs");
const { collectWebTextCandidates } = require("./hunter/sources/webtext-source.cjs");
const { getHunterSourceConfig } = require("./hunter/core/source-config.cjs");
const { extractKeysFromText } = require("./hunter/core/text-key-extractor.cjs");
const { buildHunterOutput, logHunterRunSummary, writeHunterOutput } = require("./hunter/core/output-writer.cjs");
const { checkKeyValidity } = require("./hunter/core/provider-validator.cjs");
const { extractKeysFromDiff } = require("./hunter/core/diff-key-extractor.cjs");
const { processVerificationResults } = require("./hunter/core/validation-processor.cjs");

// ─── Config ──────────────────────────────────────────────────────────────────

const userDataPath = process.env.HEX_USER_DATA || __dirname;
const OUTPUT_FILE = path.join(userDataPath, "leaked-api-keys.json");

const DELAY_BETWEEN_REQUESTS_MS = 3000; // Increased delay to be more polite to APIs
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const githubClient = createGitHubClient({
  fetchNonce: process.env.GITHUB_FETCH_NONCE || "v2:b22f1899-13e7-7e2d-e0b3-6d53acc4732b",
  maxRetries: Number(process.env.GITHUB_SEARCH_MAX_RETRIES || 5),
  retryDelayMs: Number(process.env.GITHUB_SEARCH_RETRY_DELAY_MS || 10000),
  timeoutMs: Number(process.env.GITHUB_HTTP_TIMEOUT_MS || 15000),
  delay,
});
const { fetchDiff, searchGitHub } = githubClient;

// Concurrency limit for parallel operations (e.g., fetching diffs, validating keys)
const CONCURRENCY_LIMIT = 5;
// ─── Utility for running promises with a concurrency limit ────────────────────
async function pLimit(fn, limit, items) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);

    if (limit <= items.length) { // Only apply concurrency limit if there are enough items
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const generatedAt = new Date().toISOString();
  console.log("🔍 Searching configured sources for leaked API keys...\n");

  const sourceConfig = getHunterSourceConfig(process.env);
  const sourceResults = await collectSources([
    {
      name: "github",
      run: () => collectGitHubCandidates({
        searchQueries: SEARCH_QUERIES,
        searchGitHub,
        delay,
        delayBetweenRequestsMs: DELAY_BETWEEN_REQUESTS_MS,
      }),
    },
    { name: "grayhat", run: () => collectGrayhatCandidates({ config: sourceConfig.grayhat, logger: console }) },
    { name: "gitlab", run: () => collectGitLabCandidates({ config: sourceConfig.gitlab, searchQueries: SEARCH_QUERIES, logger: console }) },
    { name: "gist", run: () => collectGistCandidates({ config: sourceConfig.gist, searchQueries: SEARCH_QUERIES, logger: console }) },
    { name: "webtext", run: () => collectWebTextCandidates({ config: sourceConfig.webtext, logger: console }) },
  ], {
    maxAttempts: Number(process.env.HUNTER_SOURCE_MAX_ATTEMPTS || 2),
    baseDelayMs: Number(process.env.HUNTER_SOURCE_RETRY_DELAY_MS || 750),
  });

  for (const sourceRun of sourceResults.diagnostics || []) {
    const state = sourceRun.status === "completed" ? "OK" : "FAILED";
    console.log(`  [${state}] ${sourceRun.source}: ${sourceRun.candidates} candidate(s), ${sourceRun.errors} error(s), ${sourceRun.attempts} attempt(s), ${sourceRun.durationMs}ms`);
  }

  const summary = mergeSourceSummaries(sourceResults);
  const errors = mergeSourceErrors(sourceResults);
  const githubSource = sourceResults.find((item) => item.source === "github") || { unique: [] };
  const derivedSources = sourceResults.filter((item) => item.source !== "github");
  const unique = githubSource.unique || [];
  const derivedExtractedKeys = dedupeRecords(derivedSources.flatMap((item) => item.extractedKeys || []));
  const derivedSourceNames = derivedSources.map((item) => item.source).join(', ') || 'derived';

  console.log(`\n🔎 Verifying ${unique.length} unique GitHub commits and ${derivedExtractedKeys.length} ${derivedSourceNames} extracted key candidate(s)...\n`);

  const diffResults = await pLimit(async (commit) => {
    if (!commit.repo_owner || !commit.repo_name || !commit.sha) {
      console.warn(`  ⚠ Skipping malformed commit: ${JSON.stringify(commit)}`);
      return { commit, diff: null, keys: [] };
    }

    const diff = await fetchDiff(
      commit.repo_owner,
      commit.repo_name,
      commit.sha,
    );
    await delay(600);

    if (!diff) {
      process.stdout.write(`  ⚠  ${commit.sha.slice(0, 8)} — could not fetch diff\n`);
      return { commit, diff: null, keys: [] };
    }

    const keys = extractKeysFromDiff(diff, {
      source: "github",
      sourceType: "commit",
      sourceUrl: commit.commit_url || null,
      repo: commit,
      query: commit.query || null,
      discoveredAt: commit.author_date || new Date().toISOString(),
    });

    if (keys.length === 0) {
      process.stdout.write(`  ✗  ${commit.sha.slice(0, 8)} — no real key found\n`);
      return { commit, diff, keys: [] };
    }
    return { commit, diff, keys };
  }, CONCURRENCY_LIMIT, unique);

  const derivedResults = derivedExtractedKeys.map((record, index) => ({
    commit: {
      sha: `${record.source || 'derived'}-${index + 1}`,
      provider: record.provider || 'Derived',
      repo_owner: record.metadata?.project_path?.split('/')?.[0] || record.metadata?.bucket || record.source || 'derived',
      repo_name: record.metadata?.project_path?.split('/')?.slice(1).join('/') || record.metadata?.file_path || record.metadata?.bucket || 'source',
      commit_url: record.sourceUrl || null,
      query: record.query || null,
      author_date: record.discoveredAt || new Date().toISOString(),
      message: record.lineContent || null,
      source: record.source || 'derived',
    },
    diff: null,
    keys: [record],
  }));

  const verificationResults = [...diffResults, ...derivedResults];

  const confirmed = await processVerificationResults({
    verificationResults,
    summary,
    generatedAt,
    checkKeyValidity,
    runLimited: pLimit,
    concurrencyLimit: CONCURRENCY_LIMIT,
    logger: console,
  });
  const output = buildHunterOutput({
    generatedAt,
    totalCandidates: unique.length + derivedExtractedKeys.length,
    confirmed,
    summary,
    sourceRuns: sourceResults.diagnostics || [],
    errors,
  });

  writeHunterOutput(OUTPUT_FILE, output);
  logHunterRunSummary({
    outputPath: OUTPUT_FILE,
    confirmedCount: confirmed.length,
    summary,
    errors,
  });
}

async function executeOnce() {
  try {
    await run();
  } catch (err) {
    console.error("Run failed:", err);
    process.exit(1);
  }
}

executeOnce();