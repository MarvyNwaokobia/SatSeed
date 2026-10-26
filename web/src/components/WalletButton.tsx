"use client";

import { shortAddress } from "@/lib/address";
import { useWallet } from "./WalletProvider";

export function WalletButton() {
  const { account, connecting, connect, wrongChain, switchChain } = useWallet();

  if (!account) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="rounded-full border border-leaf px-4 py-1.5 text-sm font-semibold text-leaf transition hover:bg-leaf hover:text-cream disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <button
          onClick={switchChain}
          className="rounded-full bg-clay px-3 py-1.5 text-xs font-semibold text-cream hover:opacity-90"
        >
          Switch network
        </button>
      )}
      <span className="rounded-full bg-ink/10 px-3 py-1.5 font-mono text-xs" title={account}>
        {shortAddress(account)}
      </span>
    </div>
  );
}
