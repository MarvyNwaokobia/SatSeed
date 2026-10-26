import { describe, expect, it } from "vitest";
import { MEMO_MAX_BYTES, formatMusd, memoBytes, parseTipAmount } from "./format";

describe("parseTipAmount", () => {
  it("parses whole and decimal amounts to 18 decimals", () => {
    expect(parseTipAmount("5")).toBe(5n * 10n ** 18n);
    expect(parseTipAmount("0.5")).toBe(5n * 10n ** 17n);
    expect(parseTipAmount(" 1.25 ")).toBe(125n * 10n ** 16n);
    expect(parseTipAmount("0.000000000000000001")).toBe(1n);
  });

  it("rejects zero, negatives, junk and too many decimals", () => {
    for (const v of ["", "0", "0.0", "-1", "abc", "1e3", "1,5", ".5", "1.", "0.0000000000000000001"]) {
      expect(parseTipAmount(v)).toBeNull();
    }
  });
});

describe("formatMusd", () => {
  it("formats with grouping and two decimals", () => {
    expect(formatMusd(1234567800000000000000n)).toBe("1,234.57");
    expect(formatMusd(0n)).toBe("0.00");
  });
});

describe("memoBytes", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(memoBytes("")).toBe(0);
    expect(memoBytes("hello")).toBe(5);
    expect(memoBytes("é")).toBe(2);
    expect(memoBytes("😀")).toBe(4);
  });

  it("flags a memo that is under 140 characters but over 140 bytes", () => {
    const memo = "😀".repeat(36);
    expect(memo.length).toBeLessThan(MEMO_MAX_BYTES);
    expect(memoBytes(memo)).toBeGreaterThan(MEMO_MAX_BYTES);
  });
});
