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

## Getting Started

```bash
nvm use
yarn install
yarn dev           # mainnet, port 3001
yarn dev:staging   # testnet-staging, port 3001
```

## Building

```bash
yarn build:mainnet     # production build (mainnet)
yarn build:staging     # production build (testnet-staging)
```

Static output goes to `out/` (Next.js static export for GitHub Pages).

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

Deployed automatically to GitHub Pages on push to `main` via [deploy.yml](.github/workflows/deploy.yml).

## License

MIT
