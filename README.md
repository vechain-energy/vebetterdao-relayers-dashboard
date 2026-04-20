# VeBetterDAO Relayers Dashboard

Dashboard for VeBetterDAO's auto-voting relayer system. Tracks relayer analytics, reward pool stats, round-by-round performance, and per-relayer information.

## Deployments

- GitHub Pages project-site build profile: `https://vechain-energy.github.io/vebetterdao-relayers-dashboard/`

## What are Relayers?

Relayers are off-chain services that execute auto-votes and claim rewards on behalf of VeBetterDAO users who have opted into auto-voting on `XAllocationVoting`. Relayers earn fees from the `RelayerRewardsPool` for performing these actions.

This dashboard provides transparency into:
- Round-by-round auto-voting activity
- Relayer performance and reward distribution
- VTHO gas costs vs B3TR fee rewards (ROI)
- Number of active relayers and auto-voting users

Relayer rankings and proportional reward shares are derived from the report's recorded per-round weighted actions, with top relayers ordered by earned B3TR. Round-level `numRelayers` counts active relayers with recorded work in that round, not the total registered relayer set.

## Getting Started

```bash
nvm use
yarn install
yarn dev           # mainnet, port 3001
yarn dev:staging   # testnet-staging, port 3001
```

The project expects the Node version pinned in [`.nvmrc`](.nvmrc), which the scheduled report workflow also uses so the tracked `better-sqlite3` state stays compatible.

The default mainnet node is `https://mainnet.vechain.org`.

To use the faster local node in development, add a `.env` file:

```bash
cp .env.example .env
```

`.env` example:

```bash
# Node-side report / backfill scripts
MAINNET_NODE_URL=http://mainnet.vechain.host3.builder.eco

# Optional browser-side override for the in-app `/run` relayer flow
# NEXT_PUBLIC_MAINNET_NODE_URL=http://mainnet.vechain.host3.builder.eco
# NEXT_PUBLIC_TESTNET_NODE_URL=https://testnet.vechain.org

# Optional: point the UI at a runtime-hosted report instead of the bundled file.
# NEXT_PUBLIC_REPORT_URL=https://raw.githubusercontent.com/vechain-energy/vebetterdao-relayers-dashboard/main/public/data/report.json
```

Next.js reads this automatically for the dashboard UI. The report scripts use `MAINNET_NODE_URL`, and the in-browser `/run` flow uses `NEXT_PUBLIC_MAINNET_NODE_URL` / `NEXT_PUBLIC_TESTNET_NODE_URL` when they are set.

## Building

```bash
NEXT_PUBLIC_BASE_PATH="" yarn build:mainnet
NEXT_PUBLIC_BASE_PATH="/vebetterdao-relayers-dashboard" yarn build:mainnet
NEXT_PUBLIC_BASE_PATH="" yarn build:staging
NEXT_PUBLIC_BASE_PATH="/vebetterdao-relayers-dashboard" yarn build:staging
```

Build profiles:

- Root-domain profile: use `NEXT_PUBLIC_BASE_PATH=""` for ad-hoc local or external builds
- GitHub Pages project-site profile: use `NEXT_PUBLIC_BASE_PATH="/vebetterdao-relayers-dashboard"` for the published deployment from this repository

Static output goes to `out/` for both profiles.

## Data Updates

Dashboard data (`public/data/report.json`) is updated by a [GitHub Action](.github/workflows/update-data.yml) that runs the incremental report pipeline (`yarn report:refresh`) against mainnet every 30 minutes for the rest of Monday after the weekly round rollover starts, then once daily for the rest of the week. As of 2026-04-13, that means Mondays from 09:30 through 23:30 in Germany (`07:30-21:30 UTC`) and one daily refresh at 10:00 in Germany on Tuesday through Sunday (`08:00 UTC`).

To keep the scheduled refresh fast, the workflow restores a `node_modules` cache keyed by `yarn.lock` and `.nvmrc`, so warm runs can skip reinstalling dependencies entirely.

The published GitHub Pages build reads the aggregate report from `main` at runtime through `NEXT_PUBLIC_REPORT_URL`, so refreshed JSON becomes visible as soon as the update workflow pushes the new report commit. Local development and ad-hoc builds still fall back to the bundled `/data/report.json` file when `NEXT_PUBLIC_REPORT_URL` is unset.

The pipeline:
- stores fetched chain state in the tracked SQLite database at `state/actions.sqlite`
- rebuilds only affected or still-mutable round reports in `public/data/report.<round>.json`
- rewrites the aggregate report to both `public/data/report.json` and `apps/relayer-dashboard/public/data/report.json`
- stores claim activity on the actual claimed round, so late claims refresh the previous round instead of the new live round

If you change the round-attribution storage semantics or need a full repair, delete `state/actions.sqlite` and rerun the refresh once from a clean checkout so the tracked DB and generated reports are rebuilt from scratch.

To run manually:

```bash
yarn report:refresh
```

The legacy analyzer remains available for manual fallback and backfill work:

```bash
yarn analyze-auto-voting --checkpoint public/data/report.json --output public/data/report.json
```

## Tech Stack

- **Next.js 14** (App Router, static export)
- **Chakra UI v3**
- **VeChain Kit** (`@vechain/vechain-kit`)
- **React Query** for server state
- **Recharts** for data visualization

## Related Repositories

| Repository | Description |
|---|---|
| [vebetterdao-relayer-node](https://github.com/vechain/vebetterdao-relayer-node) | Relayer node that executes auto-votes and claims rewards |
| [vechain-ai-skills](https://github.com/vechain/vechain-ai-skills) | AI skills for building on VeChain |

## Deployment

The GitHub Pages workflow in [deploy.yml](.github/workflows/deploy.yml):

- builds and publishes only the repo-subpath Pages artifact used by this repository
- uses `NEXT_PUBLIC_REPORT_URL` so production reads report updates from the repository at runtime instead of bundling them into each Pages artifact
- removes `out/data` before upload so the deployed artifact cannot serve stale bundled report files
- restores both `node_modules` and `.next/cache` caches to speed up repeated builds
- runs automatically on pushes that affect the deployed app, while data-only report refresh commits no longer need a Pages rebuild

## License

MIT
