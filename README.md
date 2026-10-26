# SatSeed

A public record of how people take part in Mezo, drawn as a plant that grows with real activity.

- `contracts/`: Foundry. `SatSeedRegistry` (opt-in claim by handle, free via EIP-712 signature) and `SatSeedTips` (non-custodial MUSD tips). `forge test`
- `web/`: Next.js, Tailwind, Remotion (`@remotion/player`) for the plant. `pnpm dev`, `pnpm test`

## Tests

- `cd contracts && forge test`: contract unit, fuzz and invariant tests.
- `cd web && pnpm test`: web unit tests, plus a chain-helper test against a local `anvil` (skipped if `anvil` or `forge build` output is missing).
- `cd web && pnpm e2e`: full browser test. Starts a local chain, deploys the contracts, builds the app against them and drives Chrome through join, tip and error cases (~2 minutes). Needs foundry and Google Chrome (or `CHROME_PATH`). Everything is local and throwaway.

## Pages

- `/` landing, `/dashboard` most active wallets with a side panel and Tip button, `/join` claim a handle, `/me` your own garden, `/garden/<address>` any public garden.
- Claiming and tipping need the contracts deployed: copy `web/.env.example` to `web/.env.local` and fill in the addresses. Until then the UI says "not live yet".
- Wallets: any injected EVM wallet for now.

Garden pages currently show **demo data** derived from the address; real chain data needs the indexer (Phase 1 in the brief).

## Setup

```
git clone --recurse-submodules https://github.com/MarvyNwaokobia/SatSeed.git
cd SatSeed/contracts && forge test
cd ../web && pnpm install && pnpm dev
```
