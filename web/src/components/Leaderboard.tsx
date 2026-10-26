"use client";

import Link from "next/link";
import { useState } from "react";
import { shortAddress } from "@/lib/address";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import { GrowthBars } from "./GrowthBars";
import { MiniPlant } from "./MiniPlant";
import { PlantPlayer } from "./PlantPlayer";
import { TipPanel } from "./TipPanel";

export function Leaderboard({ top, newcomers }: { top: LeaderboardEntry[]; newcomers: LeaderboardEntry[] }) {
  const [selected, setSelected] = useState(top[0].address);
  const entry = [...top, ...newcomers].find((e) => e.address === selected) ?? top[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10">
        <section aria-labelledby="top-heading">
          <h2 id="top-heading" className="font-display text-2xl">
            Most active wallets
          </h2>
          <ol className="mt-4 space-y-2">
            {top.map((e) => (
              <li key={e.address}>
                <Row entry={e} active={e.address === selected} onSelect={() => setSelected(e.address)} />
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="new-heading">
          <h2 id="new-heading" className="font-display text-2xl">
            Just planted
          </h2>
          <p className="mt-1 text-sm opacity-70">Seeds and sprouts that have only just started.</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {newcomers.map((e) => (
              <li key={e.address}>
                <button
                  onClick={() => setSelected(e.address)}
                  aria-pressed={e.address === selected}
                  className={`w-full rounded-xl border p-2 text-left transition ${
                    e.address === selected ? "border-leaf bg-leaf/10" : "border-ink/15 hover:border-leaf"
                  }`}
                >
                  <MiniPlant growth={e.growth} />
                  <span className="mt-2 block font-mono text-xs">{shortAddress(e.address)}</span>
                  <span className="block text-xs capitalize opacity-70">{e.growth.stage}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside aria-label="Selected garden" className="lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-4 rounded-2xl border border-ink/15 p-4">
          <PlantPlayer
            key={entry.address}
            trade={entry.growth.trade}
            borrow={entry.growth.borrow}
            save={entry.growth.save}
            roots={entry.growth.roots}
            wilt={entry.growth.wilt}
            score={entry.growth.score}
          />
          <div>
            <p className="font-mono text-sm opacity-70">{shortAddress(entry.address)}</p>
            <p className="font-display text-2xl capitalize">{entry.growth.stage}</p>
            <p className="text-sm opacity-80">Growth {entry.growth.score} / 100</p>
          </div>
          <GrowthBars growth={entry.growth} notes={false} />
          {/* key resets the tip form when a different garden is selected */}
          <TipPanel key={entry.address} address={entry.address} />
          <Link
            href={`/garden/${entry.address}`}
            className="block text-center text-sm font-semibold text-leaf hover:underline"
          >
            Open the full garden →
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Row({ entry, active, onSelect }: { entry: LeaderboardEntry; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-xl border p-2 pr-4 text-left transition ${
        active ? "border-leaf bg-leaf/10" : "border-ink/15 hover:border-leaf"
      }`}
    >
      <span className="w-6 text-center font-display text-lg">{entry.rank}</span>
      <MiniPlant growth={entry.growth} className="w-20 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm">{shortAddress(entry.address)}</span>
        <span className="block text-xs capitalize opacity-70">{entry.growth.stage}</span>
      </span>
      <span className="text-right">
        <span className="block font-semibold">{entry.growth.score}</span>
        {entry.growth.wilt > 0 && <span className="block text-xs text-clay">wilting</span>}
      </span>
    </button>
  );
}
