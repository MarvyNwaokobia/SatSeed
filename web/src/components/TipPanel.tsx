"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { explainError, getMinTip, isClaimed, sendTip } from "@/lib/chain";
import { MEMO_MAX_BYTES, formatMusd, memoBytes, parseTipAmount } from "@/lib/format";
import { shortAddress } from "@/lib/address";
import { useWallet } from "./WalletProvider";

type Status =
  | { kind: "idle" }
  | { kind: "working"; step: "approving" | "tipping" }
  | { kind: "done"; hash: string }
  | { kind: "error"; message: string };

const QUICK = ["1", "5", "10"];

export function TipPanel({ address }: { address: string }) {
  const { account, config, publicClient, walletClient, wrongChain, connect, connecting, switchChain } = useWallet();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [claim, setClaim] = useState<{ address: string; claimed: boolean } | null>(null);
  const [minTip, setMinTip] = useState<bigint | null>(null);

  // Only recipients who claimed their garden can be tipped (enforced by the contract too).
  useEffect(() => {
    if (!open || !config || !publicClient) return;
    let cancelled = false;
    isClaimed(publicClient, config, address as Address)
      .then((claimed) => !cancelled && setClaim({ address, claimed }))
      .catch(() => !cancelled && setClaim(null));
    return () => {
      cancelled = true;
    };
  }, [open, config, publicClient, address]);

  // The minimum is fixed at deploy; read it once the form is opened.
  useEffect(() => {
    if (!open || !config || !publicClient) return;
    let cancelled = false;
    getMinTip(publicClient, config)
      .then((m) => !cancelled && setMinTip(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, config, publicClient]);

  const claimed = claim?.address === address ? claim.claimed : null;
  const parsed = parseTipAmount(amount);
  const belowMin = parsed !== null && minTip !== null && parsed < minTip;
  const memoSize = memoBytes(memo);
  const memoTooLong = memoSize > MEMO_MAX_BYTES;
  const canSend = parsed !== null && !belowMin && !memoTooLong && minTip !== null;
  const isSelf = account?.toLowerCase() === address.toLowerCase();
  const working = status.kind === "working";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!config || !publicClient || !walletClient || !parsed || !canSend) return;
    setStatus({ kind: "working", step: "tipping" });
    try {
      const hash = await sendTip(walletClient, publicClient, config, address as Address, parsed, memo.trim(), (step) =>
        setStatus({ kind: "working", step }),
      );
      setStatus({ kind: "done", hash });
    } catch (err) {
      setStatus({ kind: "error", message: explainError(err) });
    }
  }

  if (!config) {
    return (
      <div>
        <button disabled className="w-full cursor-not-allowed rounded-xl bg-leaf/40 px-4 py-3 font-semibold text-cream">
          Tip this garden
        </button>
        <p className="mt-2 text-xs opacity-70">Tips switch on once the contracts are deployed.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-leaf px-4 py-3 font-semibold text-cream transition hover:opacity-90"
      >
        Tip this garden
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-ink/15 p-4" aria-live="polite">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Send a tip in MUSD</h3>
        <button onClick={() => setOpen(false)} className="text-xs font-semibold underline opacity-70">
          Close
        </button>
      </div>

      {!account ? (
        <button
          onClick={connect}
          disabled={connecting}
          className="w-full rounded-xl bg-leaf px-4 py-2.5 font-semibold text-cream disabled:opacity-60"
        >
          {connecting ? "Connecting…" : "Connect wallet to tip"}
        </button>
      ) : wrongChain ? (
        <button onClick={switchChain} className="w-full rounded-xl bg-clay px-4 py-2.5 font-semibold text-cream">
          Switch to the right network
        </button>
      ) : isSelf ? (
        <p className="text-sm">That&apos;s your own garden, so there&apos;s no one to tip.</p>
      ) : claimed === null ? (
        <p className="text-sm opacity-70">Checking whether this garden can receive tips…</p>
      ) : claimed === false ? (
        <p className="text-sm">
          This wallet hasn&apos;t claimed its garden yet, so it can&apos;t receive tips. Once the owner joins, you&apos;ll be able to
          tip it here.
        </p>
      ) : status.kind === "done" ? (
        <p className="text-sm">
          Tip sent. <span className="font-mono text-xs break-all opacity-70">{status.hash}</span>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="tip-amount" className="mb-1 block text-sm font-semibold">
              Amount (MUSD)
            </label>
            <input
              id="tip-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={parsed === null || belowMin}
              aria-describedby="tip-amount-hint"
              className="w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2 outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/30"
            />
            <p id="tip-amount-hint" className={`mt-1 text-xs ${belowMin ? "text-red-700 dark:text-red-300" : "opacity-60"}`}>
              {minTip === null ? "Loading the minimum…" : `Minimum tip: ${formatMusd(minTip)} MUSD`}
            </p>
            <div className="mt-2 flex gap-2">
              {QUICK.filter((q) => minTip === null || (parseTipAmount(q) ?? 0n) >= minTip).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q)}
                  className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold hover:border-leaf"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="tip-memo" className="mb-1 block text-sm font-semibold">
              Note (optional)
            </label>
            <input
              id="tip-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              aria-invalid={memoTooLong}
              aria-describedby="tip-memo-hint"
              className="w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2 outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/30"
            />
            <p id="tip-memo-hint" className={`mt-1 text-xs ${memoTooLong ? "text-red-700 dark:text-red-300" : "opacity-60"}`}>
              {memoSize} / {MEMO_MAX_BYTES} bytes{memoTooLong ? ": too long (emoji use several bytes each)" : ""}
            </p>
          </div>
          <button
            type="submit"
            disabled={!canSend || working}
            className="w-full rounded-xl bg-leaf px-4 py-2.5 font-semibold text-cream disabled:opacity-50"
          >
            {working
              ? status.step === "approving"
                ? "Approve MUSD in your wallet…"
                : "Confirm the tip in your wallet…"
              : "Send tip"}
          </button>
          <p className="text-xs opacity-60">
            Sending to <span className="font-mono">{shortAddress(address)}</span>. Check the address, not just a name:
            handles are chosen by their owners and aren&apos;t verified. The tip goes straight to their wallet; SatSeed
            never holds your funds. Network gas is paid in BTC.
          </p>
        </form>
      )}

      {status.kind === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {status.message}
        </p>
      )}
    </div>
  );
}
