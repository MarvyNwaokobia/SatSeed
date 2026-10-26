import { describe, expect, it } from "vitest";
import { parseAddress, shortAddress } from "./address";

const lower = "0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186";

describe("parseAddress", () => {
  it("checksums a valid lowercase address", () => {
    expect(parseAddress(lower)).toBe("0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186");
  });

  it("trims whitespace", () => {
    expect(parseAddress(`  ${lower}\n`)).not.toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseAddress("")).toBeNull();
    expect(parseAddress("hello")).toBeNull();
    expect(parseAddress("0x1234")).toBeNull();
    expect(parseAddress(lower + "00")).toBeNull();
    expect(parseAddress("0xZZ468a1ddc392dcdbef6db6e34e89aa338f9f186")).toBeNull();
  });

  it("rejects an address with a wrong mixed-case checksum", () => {
    // Flip the case of one letter in a correctly checksummed address.
    expect(parseAddress("0xdd468A1DDc392dcdbEf6db6e34E89AA338F9F186")).toBeNull();
  });
});

describe("shortAddress", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(shortAddress("0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186")).toBe("0xdD46…F186");
  });
});
