// Growth scoring. Weights and curves are PLACEHOLDERS: the brief says they must be
// set from real Mezo data (Phase 1) before launch. Shape is what matters here:
// cost- and time-based inputs, diminishing returns, gentle decay.

// Tips are deliberately NOT an input here. A second wallet can tip you for free-ish, so counting
// tips would make growth farmable. Keep it that way unless tips become costly to fake.

export type Activity = {
  /** Swap fees paid, in MUSD (fees, not raw volume, so fake volume costs money). */
  tradeFeesMusd: number;
  /** Distinct pools traded in. */
  poolsTraded: number;
  /** Time-weighted MUSD debt held with a healthy ratio, in MUSD-days. */
  healthyDebtMusdDays: number;
  /** Time-weighted savings-vault / lock balance, in MUSD-days. */
  savedMusdDays: number;
  /** Distinct weeks with any activity. */
  weeksActive: number;
  /** Weeks since the last activity (0 = active this week). */
  weeksSinceActive: number;
};

export type Stage = "seed" | "sprout" | "sapling" | "young tree" | "mature tree";

export type Growth = {
  /** Each 0..1. */
  trade: number;
  borrow: number;
  save: number;
  roots: number;
  /** 0 = thriving, 1 = fully wilted. */
  wilt: number;
  /** 0..100 */
  score: number;
  stage: Stage;
};

/** Saturating curve: 0 at 0, approaches 1, never exceeds it. */
export function saturate(value: number, halfPoint: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value / (value + halfPoint);
}

export const WEIGHTS = { trade: 0.3, borrow: 0.3, save: 0.2, roots: 0.2 } as const;

const WILT_GRACE_WEEKS = 1;
const WILT_FULL_WEEKS = 9;

export function stageFor(score: number): Stage {
  if (score < 5) return "seed";
  if (score < 20) return "sprout";
  if (score < 40) return "sapling";
  if (score < 70) return "young tree";
  return "mature tree";
}

export function computeGrowth(a: Activity): Growth {
  // Trade: fees paid, nudged up by pool variety (capped so one-pool farming is limited).
  const variety = 1 + 0.15 * Math.min(Math.max(a.poolsTraded - 1, 0), 4);
  const trade = Math.min(saturate(a.tradeFeesMusd * variety, 50), 1);

  const borrow = saturate(a.healthyDebtMusdDays, 30_000);
  const save = saturate(a.savedMusdDays, 30_000);
  const roots = saturate(a.weeksActive, 12);

  // Gentle decay: a grace week, then a linear fade. Never punishes below zero growth.
  const quietWeeks = Math.max(a.weeksSinceActive - WILT_GRACE_WEEKS, 0);
  const wilt = Math.min(quietWeeks / (WILT_FULL_WEEKS - WILT_GRACE_WEEKS), 1);

  const raw =
    trade * WEIGHTS.trade + borrow * WEIGHTS.borrow + save * WEIGHTS.save + roots * WEIGHTS.roots;
  const score = Math.round(raw * 100 * (1 - 0.5 * wilt) * 10) / 10;

  return { trade, borrow, save, roots, wilt, score, stage: stageFor(score) };
}
