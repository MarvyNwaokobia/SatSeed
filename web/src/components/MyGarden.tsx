"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGarden, getTipsReceived, type Garden, type ReceivedTip } from "@/lib/chain";
import { shortAddress } from "@/lib/address";
import { demoActivity } from "@/lib/demo";
import { formatMusd } from "@/lib/format";
import { computeGrowth } from "@/lib/score";
import { GrowthBars } from "./GrowthBars";
import { PlantPlayer } from "./PlantPlayer";
import { useWallet } from "./WalletProvider";

type Loaded = { account: string; garden: Garden | null; tips: ReceivedTip[] };

export function MyGarden() {
  const { account, config, publicClient, connect, connecting, error } = useWallet();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!account || !config || !publicClient) return;
    let cancelled = false;
    Promise.all([getGarden(publicClient, config, account), getTipsReceived(publicClient, config, account)])
      .then(([garden, tips]) => !cancelled && setLoaded({ account, garden, tips }))
      .catch(() => !cancelled && setLoaded({ account, garden: null, tips: [] }));
    return () => {
      cancelled = true;
    };
  }, [account, config, publicClient]);

  if (!account) {
    return (
      <div className="space-y-4">
        <p className="max-w-md opacity-80">Connect your wallet to see your own garden, your handle and the tips you&apos;ve received.</p>
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
    );
  }

  const growth = computeGrowth(demoActivity(account));
  const mine = loaded?.account === account ? loaded : null;
  const path = `/garden/${account}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; the link is still shown */
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[3fr_2fr]">
      <PlantPlayer
        trade={growth.trade}
        borrow={growth.borrow}
        save={growth.save}
        roots={growth.roots}
        wilt={growth.wilt}
        score={growth.score}
      />

      <section className="space-y-6">
        <div>
          {mine?.garden ? (
            <h2 className="font-display text-3xl">@{mine.garden.handle}</h2>
          ) : (
            <h2 className="font-display text-3xl capitalize">{growth.stage}</h2>
          )}
          <p className="font-mono text-sm opacity-70">{shortAddress(account)}</p>
          <p className="mt-1 opacity-80">
            <span className="capitalize">{growth.stage}</span> · Growth {growth.score} / 100
          </p>
        </div>

        {config && mine && !mine.garden && (
          <div className="rounded-xl border border-leaf/40 bg-leaf/10 p-4">
            <p className="font-semibold">You haven&apos;t claimed this garden yet.</p>
            <p className="mt-1 text-sm opacity-80">Claim it to get a handle and to receive tips.</p>
            <Link href="/join" className="mt-3 inline-block rounded-xl bg-leaf px-4 py-2 text-sm font-semibold text-cream">
              Claim my garden
            </Link>
          </div>
        )}

        <GrowthBars growth={growth} />

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={path} className="font-semibold text-leaf underline">
            Public link
          </Link>
          <button onClick={copy} className="rounded-full border border-ink/20 px-3 py-1 font-semibold hover:border-leaf">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <div>
          <h3 className="font-display text-xl">Tips received</h3>
          {!config ? (
            <p className="mt-2 text-sm opacity-70">Tips appear here once the contracts are live.</p>
          ) : !mine ? (
            <p className="mt-2 text-sm opacity-70">Loading…</p>
          ) : mine.tips.length === 0 ? (
            <p className="mt-2 text-sm opacity-70">No tips yet. Share your link.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {mine.tips.map((t) => (
                <li key={t.txHash} className="rounded-lg border border-ink/15 p-3 text-sm">
                  <span className="font-semibold">{formatMusd(t.amount)} MUSD</span> from{" "}
                  <span className="font-mono">{shortAddress(t.from)}</span>
                  {t.memo && <p className="mt-1 opacity-80">“{t.memo}”</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
          <strong>Demo growth.</strong> Your plant is generated from your address until real Mezo activity is indexed.
        </p>
      </section>
    </div>
  );
}
