<p align="center">
  <img src="assets/logo.png" alt="Softcurse Credential Hunter" width="180" />
</p>

# Softcurse Credential Hunter

Softcurse Credential Hunter is a standalone exposure-monitoring service. It discovers credential-shaped material from configured public sources, normalizes and deduplicates candidates, validates supported providers, stores results in TiDB, and exposes an authenticated bridge used by HEX.

Use it only for systems, repositories, buckets, and data you are authorized to assess. Never publish raw credentials in logs, build artifacts, issues, or screenshots.

## What it does

- Runs modular source adapters for GitHub, GitLab, Gists, GrayHatWarfare, and configured web-text sources.
- Detects known and unknown provider credential shapes through a shared provider registry.
- Scores, deduplicates, validates, and assigns freshness metadata to candidates.
- Synchronizes results and provider health into TiDB.
- Provides an authenticated admin dashboard and HEX bridge endpoints.
- Publishes the stable `hunter.v1` dashboard snapshot contract.

## Requirements

- Node.js 24
- pnpm 10.4.1
- A TiDB-compatible `DATABASE_URL`
- `ADMIN_PASSWORD` for dashboard access
- `HEX_BRIDGE_TOKEN` for the HEX-to-Hunter bridge
- Optional source credentials such as `GITLAB_TOKEN` and `GRAYHAT_TOKEN`

## Local setup

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

Create a local `.env` file for development. It is ignored by Git:

```dotenv
DATABASE_URL=mysql://USER:PASSWORD@HOST:4000/DATABASE
ADMIN_PASSWORD=replace-me
HEX_BRIDGE_TOKEN=replace-with-a-long-random-token
GITLAB_TOKEN=
GRAYHAT_ENABLED=false
GRAYHAT_TOKEN=
```

## Hunter commands

```powershell
pnpm hunt
pnpm hunt:sync
pnpm check
pnpm test
pnpm build
```

`pnpm hunt` writes its local runtime output to `scripts/leaked-api-keys.json`. The file is ignored and must not be committed or uploaded as a workflow artifact. `pnpm hunt:sync` imports the verified output into TiDB.

## Scheduled workflow

[`.github/workflows/credential-hunter.yml`](.github/workflows/credential-hunter.yml) runs every 12 hours and can also be started manually. Configure `DATABASE_URL` as a GitHub Actions secret. Set the repository variable `GRAYHAT_ENABLED=true` to activate GrayHatWarfare ingestion, and store its token as the `GRAYHAT_TOKEN` Actions secret. Optional source tokens should always be stored as Actions secrets.

The workflow installs with the frozen pnpm lockfile, type-checks the project, runs the multi-source hunter, verifies the output schema, and then synchronizes it. It deliberately does not upload raw hunt output.

## API

All bridge endpoints require either `Authorization: Bearer <HEX_BRIDGE_TOKEN>` or `x-hex-token: <HEX_BRIDGE_TOKEN>`.

- `GET /api/hunter/status`
- `GET /api/hunter/provider-stats`
- `GET /api/hunter/key-summary`
- `GET /api/hunter/valid-keys`
- `GET /api/hunter/audit?limit=20`
- `/api/trpc/*` for the dashboard

The admin dashboard is available at `/admin/keys`; audit history is at `/admin/audit`.

## Architecture

- `scripts/hunter/core/`: extraction, scoring, deduplication, source policy, and validation planning.
- `scripts/hunter/sources/`: isolated source clients and normalizers.
- `shared/providerRegistry.ts`: canonical provider names, aliases, and capabilities.
- `server/credentialHunterIntegration.ts`: hunt-output import and database synchronization.
- `server/hunterContract.ts`: stable `hunter.v1` dashboard snapshot.
- `functions/api/[[route]].ts`: Cloudflare Pages API and authenticated HEX bridge.
- `client/src/pages/`: operator dashboard and audit UI.

## Security notes

- Keep every token in platform secrets, never in tracked configuration.
- Use a long independent value for `HEX_BRIDGE_TOKEN`.
- Restrict source scanning to authorized targets and honor source terms and rate limits.
- Rotate exposed credentials through the owning provider; validation does not make a leaked key safe.
- Review CORS, rate limiting, and access logs before exposing a deployment publicly.

## More documentation

- [Hunter contract](HUNTER_CONTRACT_V1.md)
- [Upgrade roadmap](HUNTER_UPGRADE_ROADMAP.md)
