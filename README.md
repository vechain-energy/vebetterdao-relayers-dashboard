# VeBetterDAO Relayers Dashboard

Dashboard for VeBetterDAO's auto-voting relayer system. Tracks relayer analytics, reward pool stats, round-by-round performance, and per-relayer information.

## Deployments

- Custom-domain build profile: [relayers.vebetterdao.org](https://relayers.vebetterdao.org)
- GitHub Pages project-site build profile: `https://<owner>.github.io/vebetterdao-relayers-dashboard/`

## What are Relayers?

Relayers are off-chain services that execute auto-votes and claim rewards on behalf of VeBetterDAO users who have opted into auto-voting on `XAllocationVoting`. Relayers earn fees from the `RelayerRewardsPool` for performing these actions.

This dashboard provides transparency into:
- Round-by-round auto-voting activity
- Relayer performance and reward distribution
- VTHO gas costs vs B3TR fee rewards (ROI)
- Number of active relayers and auto-voting users

## Getting Started

```bash
nvm use
yarn install
yarn dev           # mainnet, port 3001
yarn dev:staging   # testnet-staging, port 3001
```

## Building

```bash
NEXT_PUBLIC_BASE_PATH="" yarn build:mainnet
NEXT_PUBLIC_BASE_PATH="/vebetterdao-relayers-dashboard" yarn build:mainnet
NEXT_PUBLIC_BASE_PATH="" yarn build:staging
NEXT_PUBLIC_BASE_PATH="/vebetterdao-relayers-dashboard" yarn build:staging
```

Build profiles:

- Root-domain profile: use `NEXT_PUBLIC_BASE_PATH=""` for custom-domain deployments such as `relayers.vebetterdao.org`
- GitHub Pages project-site profile: use `NEXT_PUBLIC_BASE_PATH="/vebetterdao-relayers-dashboard"` for the default repository Pages deployment

Static output goes to `out/` for both profiles.

## Data Updates

Dashboard data (`public/data/report.json`) is updated hourly by a [GitHub Action](.github/workflows/update-data.yml) that runs `scripts/analyzeAutoVotingRounds.ts` against mainnet.

To run manually:

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

- validates both supported static-export profiles on every run
- publishes only the repo-subpath Pages artifact on push to `main`
- keeps the root-domain profile available as a separate supported build mode for non-Pages deployments

## License

MIT
