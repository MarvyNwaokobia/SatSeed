import { describe, expect, it } from "vitest";
import { demoActivity } from "./demo";
import { computeGrowth } from "./score";

const a = "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186";
const b = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

describe("demoActivity", () => {
  it("is deterministic and case-insensitive", () => {
    expect(demoActivity(a)).toEqual(demoActivity(a));
    expect(demoActivity(a)).toEqual(demoActivity(a.toLowerCase()));
  });

  it("differs between addresses", () => {
    expect(demoActivity(a)).not.toEqual(demoActivity(b));
  });

  it("always yields valid, non-negative inputs that score within range", () => {
    for (let i = 0; i < 200; i++) {
      const addr = "0x" + i.toString(16).padStart(4, "0").repeat(10);
      const act = demoActivity(addr);
      for (const v of Object.values(act)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      const g = computeGrowth(act);
      expect(g.score).toBeGreaterThanOrEqual(0);
      expect(g.score).toBeLessThanOrEqual(100);
    }
  });
});
