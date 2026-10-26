# SatSeed

A public record of how people take part in Mezo, drawn as a plant that grows with real activity.

- `contracts/`: Foundry. `GardenRegistry` (opt-in claim by handle, free via EIP-712 signature) and `GardenTips` (non-custodial MUSD tips). `forge test`
- `web/`: Next.js, Tailwind, Remotion (`@remotion/player`) for the plant. `pnpm dev`, `pnpm test`

Garden pages currently show **demo data** derived from the address; real chain data needs the indexer (Phase 1 in the brief).

## Setup

```
git clone --recurse-submodules https://github.com/MarvyNwaokobia/SatSeed.git
cd SatSeed/contracts && forge test
cd ../web && pnpm install && pnpm dev
```
