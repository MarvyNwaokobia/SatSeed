import { describe, expect, it } from "vitest";
import { isAddress } from "viem";
import { demoLeaderboard, demoNewcomers } from "./leaderboard";

describe("demoLeaderboard", () => {
  it("is deterministic", () => {
    expect(demoLeaderboard()).toEqual(demoLeaderboard());
  });

  it("returns the requested count of unique, valid addresses ranked from 1", () => {
    const list = demoLeaderboard(10);
    expect(list).toHaveLength(10);
    expect(new Set(list.map((e) => e.address)).size).toBe(10);
    list.forEach((e, i) => {
      expect(isAddress(e.address)).toBe(true);
      expect(e.rank).toBe(i + 1);
    });
  });

  it("is sorted by score, highest first", () => {
    const scores = demoLeaderboard(12).map((e) => e.growth.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("never overlaps with the newcomers", () => {
    const top = new Set(demoLeaderboard(12).map((e) => e.address));
    for (const n of demoNewcomers(4)) expect(top.has(n.address)).toBe(false);
  });
});

describe("demoNewcomers", () => {
  it("returns small plants (under young-tree size), lowest first", () => {
    const list = demoNewcomers(4);
    expect(list).toHaveLength(4);
    const scores = list.map((e) => e.growth.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    for (const e of list) expect(e.growth.score).toBeLessThan(40);
  });
});
