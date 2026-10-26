import { describe, expect, it } from "vitest";
import { validateHandle } from "./handle";

describe("validateHandle", () => {
  it("accepts valid handles", () => {
    for (const h of ["abc", "a_b_c", "user123", "a".repeat(32)]) expect(validateHandle(h)).toBeNull();
  });

  it("rejects bad length", () => {
    expect(validateHandle("")).not.toBeNull();
    expect(validateHandle("ab")).not.toBeNull();
    expect(validateHandle("a".repeat(33))).not.toBeNull();
  });

  it("rejects characters outside the set", () => {
    for (const h of ["Alice", "a b", "a-b", "émile", "a.b", "abc!"]) {
      expect(validateHandle(h)).not.toBeNull();
    }
  });

  it("rejects leading or trailing underscore", () => {
    expect(validateHandle("_abc")).not.toBeNull();
    expect(validateHandle("abc_")).not.toBeNull();
  });
});
