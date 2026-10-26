import type { Activity } from "./score";

/**
 * DEMO DATA ONLY. There is no indexer yet (Phase 1), so activity is derived
 * deterministically from the address to let the plant be designed and shown.
 * Replace with real chain data before this is presented as anyone's history.
 */
export function demoActivity(address: string): Activity {
  const bytes = address.toLowerCase().replace(/^0x/, "");
  const n = (i: number) => parseInt(bytes.slice(i * 4, i * 4 + 4), 16) / 0xffff; // 0..1

  return {
    tradeFeesMusd: Math.round(n(0) * n(0) * 400),
    poolsTraded: 1 + Math.floor(n(1) * 5),
    healthyDebtMusdDays: Math.round(n(2) * 120_000),
    savedMusdDays: Math.round(n(3) * 120_000),
    weeksActive: Math.floor(n(4) * 40),
    weeksSinceActive: n(5) > 0.7 ? Math.floor(n(6) * 10) : 0,
  };
}
