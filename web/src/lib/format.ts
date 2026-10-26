import { formatUnits, parseUnits } from "viem";

/** The contract limits memos by UTF-8 bytes, not characters (an emoji is 4 bytes). */
export const MEMO_MAX_BYTES = 140;

export function memoBytes(memo: string): number {
  return new TextEncoder().encode(memo).length;
}

/** Parses a user-typed MUSD amount into base units (18 decimals). Null if invalid or not positive. */
export function parseTipAmount(input: string): bigint | null {
  const v = input.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(v)) return null;
  const units = parseUnits(v, 18);
  return units > 0n ? units : null;
}

/** 1234.5678 MUSD -> "1,234.57". */
export function formatMusd(amount: bigint): string {
  const n = Number(formatUnits(amount, 18));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
