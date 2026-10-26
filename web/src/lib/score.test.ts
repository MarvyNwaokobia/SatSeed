import { describe, expect, it } from "vitest";
import { computeGrowth, saturate, stageFor, WEIGHTS, type Activity } from "./score";

const none: Activity = {
  tradeFeesMusd: 0,
  poolsTraded: 0,
  healthyDebtMusdDays: 0,
  savedMusdDays: 0,
  weeksActive: 0,
  weeksSinceActive: 0,
};

describe("saturate", () => {
  it("is 0 for zero, negative and non-finite input", () => {
    expect(saturate(0, 10)).toBe(0);
    expect(saturate(-5, 10)).toBe(0);
    expect(saturate(NaN, 10)).toBe(0);
    expect(saturate(Infinity, 10)).toBe(0);
  });

  it("is 0.5 at the half point and stays below 1", () => {
    expect(saturate(10, 10)).toBeCloseTo(0.5);
    expect(saturate(1e12, 10)).toBeLessThan(1);
  });

  it("is monotonic", () => {
    expect(saturate(20, 10)).toBeGreaterThan(saturate(10, 10));
  });
});

describe("weights", () => {
  it("sum to 1", () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe("stageFor", () => {
  it("maps score ranges to stages", () => {
    expect(stageFor(0)).toBe("seed");
    expect(stageFor(4.9)).toBe("seed");
    expect(stageFor(5)).toBe("sprout");
    expect(stageFor(20)).toBe("sapling");
    expect(stageFor(40)).toBe("young tree");
    expect(stageFor(70)).toBe("mature tree");
    expect(stageFor(100)).toBe("mature tree");
  });
});

describe("computeGrowth", () => {
  it("returns an empty seed for no activity", () => {
    const g = computeGrowth(none);
    expect(g.score).toBe(0);
    expect(g.stage).toBe("seed");
    expect(g.wilt).toBe(0);
  });

  it("keeps every component within 0..1 and score within 0..100 for huge inputs", () => {
    const g = computeGrowth({
      tradeFeesMusd: 1e9,
      poolsTraded: 1000,
      healthyDebtMusdDays: 1e12,
      savedMusdDays: 1e12,
      weeksActive: 1e6,
      weeksSinceActive: 0,
    });
    for (const k of ["trade", "borrow", "save", "roots"] as const) {
      expect(g[k]).toBeGreaterThanOrEqual(0);
      expect(g[k]).toBeLessThanOrEqual(1);
    }
    expect(g.score).toBeLessThanOrEqual(100);
    expect(g.stage).toBe("mature tree");
  });

  it("caps the pool-variety bonus so one extra pool matters less than real fees", () => {
    const base = { ...none, tradeFeesMusd: 50 };
    const many = computeGrowth({ ...base, poolsTraded: 500 }).trade;
    const five = computeGrowth({ ...base, poolsTraded: 5 }).trade;
    expect(many).toBeCloseTo(five);
  });

  it("rewards more fees paid", () => {
    const a = computeGrowth({ ...none, tradeFeesMusd: 10, poolsTraded: 1 });
    const b = computeGrowth({ ...none, tradeFeesMusd: 100, poolsTraded: 1 });
    expect(b.trade).toBeGreaterThan(a.trade);
  });

  it("does not wilt within the grace week", () => {
    expect(computeGrowth({ ...none, weeksSinceActive: 0 }).wilt).toBe(0);
    expect(computeGrowth({ ...none, weeksSinceActive: 1 }).wilt).toBe(0);
  });

  it("wilts gradually and then caps at 1", () => {
    const w3 = computeGrowth({ ...none, weeksSinceActive: 3 }).wilt;
    const w6 = computeGrowth({ ...none, weeksSinceActive: 6 }).wilt;
    expect(w3).toBeGreaterThan(0);
    expect(w6).toBeGreaterThan(w3);
    expect(computeGrowth({ ...none, weeksSinceActive: 500 }).wilt).toBe(1);
  });

  it("lowers score when quiet but never below half, and recovers on return", () => {
    const active: Activity = {
      tradeFeesMusd: 200,
      poolsTraded: 3,
      healthyDebtMusdDays: 60_000,
      savedMusdDays: 60_000,
      weeksActive: 20,
      weeksSinceActive: 0,
    };
    const thriving = computeGrowth(active);
    const wilted = computeGrowth({ ...active, weeksSinceActive: 50 });
    expect(wilted.score).toBeLessThan(thriving.score);
    expect(wilted.score).toBeGreaterThanOrEqual(thriving.score * 0.5 - 0.1);
    expect(computeGrowth({ ...active, weeksSinceActive: 0 }).score).toBe(thriving.score);
  });
});
