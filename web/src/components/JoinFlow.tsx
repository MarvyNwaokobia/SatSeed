"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { claimGarden, explainError, getGarden, isHandleAvailable, isHandleCoolingDown, type Garden } from "@/lib/chain";
import { validateHandle } from "@/lib/handle";
import { useWallet } from "./WalletProvider";

type Claim = { kind: "idle" } | { kind: "working" } | { kind: "done" } | { kind: "error"; message: string };

export function JoinFlow() {
  const { account, config, publicClient, walletClient, connect, connecting, wrongChain, switchChain, error } = useWallet();
  const [handle, setHandle] = useState("");
  const [claim, setClaim] = useState<Claim>({ kind: "idle" });
  const [existing, setExisting] = useState<{ account: string; garden: Garden | null } | null>(null);
  const [avail, setAvail] = useState<{ handle: string; ok: boolean; cooling: boolean } | null>(null);

  const formatError = validateHandle(handle);

  // Does this wallet already have a garden?
  useEffect(() => {
    if (!account || !config || !publicClient) return;
    let cancelled = false;
    getGarden(publicClient, config, account)
      .then((garden) => !cancelled && setExisting({ account, garden }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account, config, publicClient]);

  // Debounced availability check for a well-formed handle.
  useEffect(() => {
    if (!config || !publicClient || validateHandle(handle)) return;
    let cancelled = false;
    const t = setTimeout(() => {
      Promise.all([isHandleAvailable(publicClient, config, handle), isHandleCoolingDown(publicClient, config, handle)])
        .then(([ok, cooling]) => !cancelled && setAvail({ handle, ok, cooling }))
        .catch(() => {});
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle, config, publicClient]);

  const already = existing?.account === account ? existing.garden : null;
  const checked = !formatError && avail?.handle === handle ? avail : null;
  const availability = checked ? checked.ok : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!config || !publicClient || !walletClient || formatError || availability === false) return;
    setClaim({ kind: "working" });
    try {
      await claimGarden(walletClient, publicClient, config, handle);
      setClaim({ kind: "done" });
    } catch (err) {
      setClaim({ kind: "error", message: explainError(err) });
    }
  }

  return (
    <ol className="space-y-6">
      <Step n={1} title="Connect your wallet" done={!!account}>
        {account ? (
          <p className="text-sm opacity-80">Connected. Your wallet stays yours; SatSeed only asks you to sign.</p>
        ) : (
          <div className="space-y-2">
            <button
              onClick={connect}
              disabled={connecting}
              className="rounded-xl bg-leaf px-5 py-2.5 font-semibold text-cream disabled:opacity-60"
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        )}
      </Step>

      <Step n={2} title="Pick a handle" done={claim.kind === "done" || !!already} disabled={!account}>
        {!config ? (
          <p className="rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
            <strong>Not live yet.</strong> Claiming opens when the contracts are deployed. You can already look up any
            wallet on the <Link href="/dashboard" className="font-semibold underline">dashboard</Link>.
          </p>
        ) : already ? (
          <p className="text-sm">
            This wallet already has a garden: <strong>@{already.handle}</strong>.{" "}
            <Link href="/me" className="font-semibold text-leaf underline">
              Open it
            </Link>
          </p>
        ) : claim.kind === "done" ? (
          <p className="text-sm">
            Planted. Your garden is <strong>@{handle}</strong>.{" "}
            <Link href="/me" className="font-semibold text-leaf underline">
              Go to my garden →
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="handle" className="mb-1 block text-sm font-semibold">
                Handle
              </label>
              <div className="flex items-center rounded-xl border border-ink/20 focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/30">
                <span className="pl-3 opacity-60">@</span>
                <input
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!account}
                  aria-describedby="handle-hint"
                  className="min-w-0 flex-1 bg-transparent px-2 py-2.5 outline-none disabled:opacity-50"
                />
              </div>
              <p id="handle-hint" className="mt-1 min-h-5 text-sm">
                {handle === "" ? (
                  <span className="opacity-60">3–32 characters: lowercase letters, numbers, underscores.</span>
                ) : formatError ? (
                  <span className="text-red-700 dark:text-red-300">{formatError}</span>
                ) : availability === null ? (
                  <span className="opacity-60">Checking…</span>
                ) : availability ? (
                  <span className="text-leaf">@{handle} is available.</span>
                ) : checked?.cooling ? (
                  <span className="text-red-700 dark:text-red-300">
                    @{handle} was just released and is reserved for its previous owner for 30 days.
                  </span>
                ) : (
                  <span className="text-red-700 dark:text-red-300">@{handle} is taken.</span>
                )}
              </p>
            </div>

            {wrongChain ? (
              <button type="button" onClick={switchChain} className="rounded-xl bg-clay px-5 py-2.5 font-semibold text-cream">
                Switch to the right network
              </button>
            ) : (
              <button
                type="submit"
                disabled={!account || !!formatError || availability !== true || claim.kind === "working"}
                className="rounded-xl bg-leaf px-5 py-2.5 font-semibold text-cream disabled:opacity-50"
              >
                {claim.kind === "working" ? "Confirm in your wallet…" : "Plant my garden"}
              </button>
            )}
            <p className="text-xs opacity-60">
              Handles are first come, first served and are not verified. Having a name that looks like a Mezo team
              member or project doesn&apos;t mean they are. Please don&apos;t pick a name to impersonate someone.
            </p>
            <p className="text-xs opacity-60">
              Claiming is one small transaction (gas is paid in BTC). It only records your handle. You can change it or
              delete your garden any time.
            </p>
            {claim.kind === "error" && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {claim.message}
              </p>
            )}
          </form>
        )}
      </Step>

      <Step n={3} title="Watch it grow" done={false} disabled={claim.kind !== "done" && !already}>
        <p className="text-sm opacity-80">
          Trade, borrow, save and keep coming back. Your plant grows with real activity, and anyone can see it.
        </p>
      </Step>
    </ol>
  );
}

function Step({
  n,
  title,
  done,
  disabled,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={`flex gap-4 ${disabled ? "opacity-60" : ""}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-leaf text-cream" : "border border-ink/30"
        }`}
        aria-hidden="true"
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="font-display text-xl">{title}</h2>
        {children}
      </div>
    </li>
  );
}
