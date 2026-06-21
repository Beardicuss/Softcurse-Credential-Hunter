# Hunter Upgrade Roadmap

## Goal

Turn Credential Hunter from a GitHub-only hardcoded script into a modular multi-source exposure intelligence pipeline that can feed HEX Server and desktop HEX with richer, safer, more dynamic data.

## Phase 1 — Registry and Hardcoded Ceiling Removal

- Create a shared provider registry for canonical provider names, aliases, validation support, and AI routing priority.
- Normalize provider names at sync/import time instead of discarding anything outside a tiny whitelist.
- Move provider fallback order out of hardcoded arrays and into the shared registry.
- Move validator dispatch out of fixed switches and into registry-backed handlers.
- Start extracting giant script sections into small reusable modules.

## Phase 2 — Hunter Core Modularization

- Split the monolith hunt script into small modules:
  - `scripts/hunter/core/provider-patterns.cjs`
  - `scripts/hunter/core/source-record.cjs`
  - `scripts/hunter/core/dedupe.cjs`
  - `scripts/hunter/core/scoring.cjs`
  - `scripts/hunter/core/output-writer.cjs`
- Keep the current GitHub source working while moving logic into modules.

## Phase 3 — Multi-Source Hunting

- Keep GitHub as one source module, not the whole hunter.
- Add GrayHatWarfare source ingestion as discovery-only.
- Later sources:
  - GitLab
  - Gists
  - public bucket indexes
  - paste-style sources
  - public web configuration leaks
- All sources must emit one normalized record shape.

## Phase 4 — Query Packs and Detection Expansion

- Replace static query lists with provider-aware query packs.
- Add filename, extension, path, and regex hints per provider.
- Expand detection to support more providers and unknown-but-valuable credential classes instead of only a fixed short list.

## Phase 5 — Confidence and Deduplication

- Score candidates before expensive validation.
- Merge duplicates found across multiple sources into one entity with multiple evidence links.
- Track freshness, source confidence, and matched pattern strength.

## Phase 6 — Validation Pipeline Upgrade

- Keep provider-specific validators modular.
- Add staged validation:
  - format validation
  - lightweight probe
  - full validation
  - periodic revalidation
- Unknown providers must still be stored and surfaced even if no validator exists yet.

## Phase 7 — Hunter-to-Server Contract Freeze

- Define stable output for HEX Server:
  - canonical provider
  - aliases
  - key/candidate validity
  - confidence
  - evidence sources
  - freshness
  - last validation state
- Server should consume Hunter through this contract rather than Hunter internals.

## Phase 8 — Server Data Fidelity and Operator UI

- Persist discovery metadata in TiDB instead of losing it after JSON sync:
  - confidence and validation tier
  - match strength and validation reason
  - discovery and validation timestamps
  - freshness and revalidation state
  - source/evidence references
- Make `hunter.v1` build its complete snapshot from persisted data on Cloudflare Pages.
- Add source-health, validation queue, stale-key, and unknown-provider views.
- Add a protected **Valid Key Vault** tab:
  - group valid keys by provider
  - masked by default
  - explicit reveal/hide per key
  - copy individual key
  - copy provider group with confirmation
  - audit every reveal and copy action without logging key values
- Clarify dashboard semantics and use one canonical live query for provider counts.
- Rank Top Provider Yield by valid-key count first, then total candidates and provider name.
- Split the dashboard into small components and lazy-load heavy admin views.

## Phase 9 — Reliability, Lifecycle, and Security

- Extract remaining monolithic runner logic, including output writing.
- Add bounded retry/backoff, per-source quotas, and structured scheduled-run summaries.
- Add candidate lifecycle states, retention rules, stale-record cleanup, and revalidation scheduling.
- Restrict CORS, add rate limiting, and use safer audited key-access procedures.
- Keep raw key material out of logs, artifacts, metrics, and error responses.

## Phase 10 — Final Testing

- Add unit tests for source normalization, dedupe, scoring, freshness, validation stages, and output contracts.
- Add integration tests for hunt output, TiDB sync, unknown-provider retention, and Pages Functions bundling.
- Add an authorized-source smoke suite for GitHub, GitLab, Gist, GrayHat, and WebText adapters.
- Add deployment checks for dashboard authentication and HEX bridge compatibility.
- Add regression tests for scheduled workflow execution.

## Immediate Next Steps

1. Extract a normalized source-record module.
2. Extract dedupe + scoring modules.
3. Convert GitHub hunt path to emit normalized records.
4. Add the first GrayHatWarfare source module.
5. Expand provider/query packs without rebuilding a monolith.

## Current Progress

- Shared provider registry added and hardcoded provider discard path removed.
- Hunter sync now stores normalized providers instead of silently dropping unknown-but-valuable discoveries.
- GitHub hunting now flows through normalized source records, scoring, and dedupe helpers.
- Source orchestrator added.
- GitHub extracted into its own source module.
- GrayHatWarfare discovery source added.
- GrayHat content fetch and text extraction path added behind env-driven config.
- Shared source config module added for env-driven source behavior.
- GrayHat fetching now has extension/content-type/size safeguards.
- GitLab source added in small modules (client, normalizer, source collector).
- Main hunt runner now treats non-GitHub sources as shared derived-key sources instead of GrayHat-only special casing.
- Main hunt loop bug fixed: leakedKeysWithValidity is now initialized before validation results are pushed.
- Detection expanded with OpenRouter and newer xAI/Grok key shapes.
- Shared text extractor now has a generic hinted-secret path that derives likely providers from variable names like FOO_API_KEY.
- Generic hinted matches are suppressed when a stronger known-provider pattern already matched the same secret.
- GitHub Gist source added in small modules (client, normalizer, source collector).
- Main hunt runner now includes Gist as another derived-content source using the shared extractor path.
- Source config extended with env-driven Gist settings for query count, fetch behavior, and timeouts.
- Confidence scoring upgraded to reward source quality, source type, evidence count, and match strength.
- Source records now preserve explicit match strength so known-pattern hits outrank generic hinted secrets.
- Shared extractor now tags known-pattern vs generic-hint matches before scoring.
- Validation prioritization added in a small helper module so higher-confidence candidates are validated first.
- Paired secrets now receive explicit paired-secret match strength and confidence before validation.
- Dedupe now preserves stronger match types when generic and strong evidence collide.
- Output leaked-key records now include confidence, matchStrength, and validationTier.
- Generic WebText source added in small modules (client, normalizer, source collector).
- WebText ingests env-configured public text/config URLs and routes them through the shared extractor.
- Source config extended with env-driven WebText seed URL, timeout, and max-url controls.
- WebText source activated in the main source runner so env-configured public text/config URLs are now scanned through the shared extractor.
- Shared source guard added for min-delay pacing, error caps, and cooldown-on-error behavior.
- Source config now supports per-source safety controls via env for GrayHat, GitLab, Gist, and WebText.
- GrayHat, GitLab, and WebText now stop after repeated failures instead of running raw loops indefinitely.
- Staged validation helper added so candidates now go through cheap preflight classification before any network probe.
- Main hunt runner now separates probe-capable candidates from preflight-only candidates and logs both validation priority and validation stage counts.
- Final leaked-key output now carries validationStatus and validationReason alongside confidence, matchStrength, and validationTier.
- Freshness helper added so Hunter output now computes discoveredAt, lastValidatedAt, freshness bucket, validation age, and revalidation suggestions.
- Server sync now understands freshness metadata and logs freshness counts during refresh.
- Stable contract helper added with versioned `hunter.v1` snapshot building.
- Stable protected snapshot endpoint added: `hunter.getHunterSnapshot`.
- Contract document added so the frontend rebuild can target one fixed backend surface.
- Bounded source-level retry/backoff added with permanent-error detection and secret-safe failure messages.
- Scheduled hunt output now includes structured `source_runs` telemetry with attempts, duration, candidate counts, and error counts.
- Source retry policy is configurable through `HUNTER_SOURCE_MAX_ATTEMPTS` and `HUNTER_SOURCE_RETRY_DELAY_MS`.
- Output assembly, atomic snapshot persistence, and final summary logging extracted into `output-writer.cjs`.
- Hunter snapshots now write to a temporary file and rename atomically to avoid partial/corrupt output.
- Output writer coverage added for stable shape, atomic replacement, temporary-file cleanup, and secret-free summaries.
- Provider validation dispatch, generic probes, AWS SigV4, Azure client credentials, and Twilio pair validation extracted into `provider-validator.cjs`.
- Validator transport is injectable for deterministic network-free tests while production keeps the same HTTPS behavior.
- Provider and pair-specific status mappings are covered without exposing or logging credential values.
- GitHub HTTPS transport, commit search retry, result normalization, HTML/rate-limit detection, and diff retrieval extracted into `github-client.cjs`.
- GitHub search nonce, retry count, retry delay, and HTTP timeout are now environment-configurable.
- GitHub client behavior is covered with injected network-free tests.
- GitHub diff added-line parsing, Shannon entropy calculation, false-positive filtering, source-record creation, and confidence scoring extracted into `diff-key-extractor.cjs`.
- Diff extractor dependencies are injectable and covered for context preservation, low entropy, and false-positive rejection.
- AWS, Azure, and Twilio candidate pairing extracted into `candidate-pairing.cjs` with pair-part suppression kept explicit.
- Staged validation, prioritization, summary accounting, masking, and freshness projection extracted into `validation-processor.cjs`.
- Pairing and validation orchestration now have deterministic tests with injected validators and concurrency runners.
- Candidate lifecycle planning added with revalidation scheduling and conservative invalid/unknown retention windows.
- Scheduled lifecycle execution is dry-run by default and requires explicit `HUNTER_RETENTION_APPLY=true` before deleting records.
- Valid keys are never automatically deleted; used invalid/unknown keys are retained, and lifecycle actions are audited without key material.
- Hunter Operations now exposes a masked lifecycle preview with active retention policy, dry-run/apply mode, revalidation totals, and deletion candidates.
- Lifecycle preview serialization is regression-tested to ensure raw key values never cross the operator API.