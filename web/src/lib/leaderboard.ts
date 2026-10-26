import { getAddress, keccak256, toBytes } from "viem";
import { demoActivity } from "./demo";
import { computeGrowth, type Growth } from "./score";

export type LeaderboardEntry = {
  rank: number;
  address: string;
  growth: Growth;
};

/**
 * DEMO DATA ONLY. Deterministic wallets with deterministic activity so the dashboard can be
 * designed before an indexer exists. Replace with real per-wallet scores (Phase 1).
 */
export function demoLeaderboard(count = 12): LeaderboardEntry[] {
  const entries = Array.from({ length: count + 6 }, (_, i) => {
    const address = getAddress(`0x${keccak256(toBytes(`satseed-demo-${i}`)).slice(2, 42)}`);
    return { address, growth: computeGrowth(demoActivity(address)) };
  })
    .sort((a, b) => b.growth.score - a.growth.score || a.address.localeCompare(b.address))
    .slice(0, count);

  return entries.map((e, i) => ({ rank: i + 1, ...e }));
}

/** DEMO DATA ONLY. The newest, smallest plants: seeds and sprouts that have just started. */
export function demoNewcomers(count = 4): LeaderboardEntry[] {
  return Array.from({ length: 60 }, (_, i) => {
    const address = getAddress(`0x${keccak256(toBytes(`satseed-demo-new-${i}`)).slice(2, 42)}`);
    return { address, growth: computeGrowth(demoActivity(address)) };
  })
    .sort((a, b) => a.growth.score - b.growth.score || a.address.localeCompare(b.address))
    .slice(0, count)
    .map((e, i) => ({ rank: i + 1, ...e }));
}
