import { defineChain } from "viem";

/**
 * Mezo chain ids per the brief: testnet 31611, mainnet 31612. The RPC URL is not hard-coded
 * (unverified); set NEXT_PUBLIC_RPC_URL. Gas is paid in BTC.
 */
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31611");

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || undefined;

export const chain = defineChain({
  id: chainId,
  name: chainId === 31612 ? "Mezo" : chainId === 31611 ? "Mezo Testnet" : `Chain ${chainId}`,
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: rpcUrl ? [rpcUrl] : [] } },
});
