# Hunter Contract v1

## Purpose

This document freezes the first stable backend contract for Credential Hunter so the frontend can consume one predictable server snapshot instead of raw hunt internals.

## Stable endpoint

- tRPC: `hunter.getHunterSnapshot`
- Access: authenticated administrator
- Contract version: `hunter.v1`

## Snapshot shape

```ts
{
  contractVersion: "hunter.v1";
  generatedAt: string | null;
  totals: {
    candidates: number;
    confirmedKeys: number;
    confirmedCommits: number;
    providers: number;
  };
  freshness: {
    fresh: number;
    warm: number;
    stale: number;
    revalidationSuggested: number;
  };
  validation: {
    valid: number;
    invalid: number;
    unknown: number;
    byTier: {
      high: number;
      medium: number;
      low: number;
      unknown: number;
    };
  };
  providers: Array<{
    provider: string;
    total: number;
    valid: number;
    invalid: number;
    unknown: number;
    rateLimited: number;
    freshness: { fresh: number; warm: number; stale: number };
    revalidationSuggested: number;
    avgConfidence: number;
  }>;
  failedQueries: unknown[];
}
```

## Raw hunt inputs

The internal `scripts/leaked-api-keys.json` shape may evolve, but the contract builder currently consumes discovery timestamps, provider identity, validation state and tier, confidence, pattern strength, freshness, revalidation state, and failed-query records.

## Frontend rules

- Prefer `hunter.getHunterSnapshot` for dashboard summaries.
- Treat `contractVersion` as the compatibility gate.
- Use server-calculated freshness and provider rollups instead of deriving competing values in the browser.
- Never expose unmasked key values in monitoring views, logs, or diagnostics.
