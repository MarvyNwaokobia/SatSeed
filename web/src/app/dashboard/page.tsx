import type { Metadata } from "next";
import { Leaderboard } from "@/components/Leaderboard";
import { LookupForm } from "@/components/LookupForm";
import { demoLeaderboard, demoNewcomers } from "@/lib/leaderboard";

export const metadata: Metadata = { title: "Dashboard · SatSeed" };

export default function Dashboard() {
  const top = demoLeaderboard(12);
  const newcomers = demoNewcomers(4);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-4xl">The garden</h1>
          <p className="max-w-xl opacity-80">
            The most active wallets on Mezo and the plants they&apos;ve grown. Pick one to see it up close and send a tip.
          </p>
        </div>
        <div className="w-full md:max-w-sm">
          <LookupForm />
        </div>
      </div>

      <p className="mb-8 rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
        <strong>Demo data.</strong> These wallets and scores are generated for design purposes, not real Mezo activity.
        Tips only work for wallets that have claimed a garden.
      </p>

      <Leaderboard top={top} newcomers={newcomers} />
    </main>
  );
}
