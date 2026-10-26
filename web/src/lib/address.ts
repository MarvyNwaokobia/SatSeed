import { getAddress, isAddress } from "viem";

/** Returns the checksummed address, or null if the input is not a valid EVM address. */
export function parseAddress(input: string): string | null {
  const trimmed = input.trim();
  if (!isAddress(trimmed)) return null;
  return getAddress(trimmed);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
