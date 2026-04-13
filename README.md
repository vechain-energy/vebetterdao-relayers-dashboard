# VeBetterDAO Relayers Dashboard

Dashboard for VeBetterDAO's auto-voting relayer system. Tracks relayer analytics, reward pool stats, round-by-round performance, and per-relayer information.

**Live:** [relayers.vebetterdao.org](https://relayers.vebetterdao.org)

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

The project expects the Node version pinned in [`.nvmrc`](.nvmrc), which the hourly report workflow also uses so the tracked `better-sqlite3` state stays compatible.

The default mainnet node is `https://mainnet.vechain.org`.

To use the faster local node in development, add a `.env` file:

```bash
cp .env.example .env
```

`.env` example:

```bash
MAINNET_NODE_URL=http://mainnet.vechain.host3.builder.eco
```

Next.js reads this automatically for the dashboard UI, and the report scripts load `.env` as well.

## Building

```bash
yarn build:mainnet     # production build (mainnet)
yarn build:staging     # production build (testnet-staging)
```

Static output goes to `out/` (Next.js static export for GitHub Pages).

## Data Updates

Dashboard data (`public/data/report.json`) is updated hourly by a [GitHub Action](.github/workflows/update-data.yml) that runs the incremental report pipeline (`yarn report:refresh`) against mainnet.

The pipeline:
- stores fetched chain state in the tracked SQLite database at `state/actions.sqlite`
- rebuilds only affected or still-mutable round reports in `public/data/report.<round>.json`
- rewrites the aggregate report to both `public/data/report.json` and `apps/relayer-dashboard/public/data/report.json`

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

Deployed automatically to GitHub Pages on push to `main` via [deploy.yml](.github/workflows/deploy.yml).

## License

MIT
