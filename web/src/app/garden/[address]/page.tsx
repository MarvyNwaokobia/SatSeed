import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GrowthBars } from "@/components/GrowthBars";
import { PlantPlayer } from "@/components/PlantPlayer";
import { TipPanel } from "@/components/TipPanel";
import { parseAddress, shortAddress } from "@/lib/address";
import { demoActivity } from "@/lib/demo";
import { computeGrowth } from "@/lib/score";

export async function generateMetadata({ params }: PageProps<"/garden/[address]">) {
  const { address } = await params;
  const parsed = parseAddress(address);
  return { title: parsed ? `Garden ${shortAddress(parsed)} · SatSeed` : "Garden · SatSeed" };
}

export default function GardenPage({ params }: PageProps<"/garden/[address]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6" aria-busy />}>
      <Garden params={params} />
    </Suspense>
  );
}

async function Garden({ params }: Pick<PageProps<"/garden/[address]">, "params">) {
  const { address: raw } = await params;
  const address = parseAddress(raw);
  if (!address) notFound();

  const growth = computeGrowth(demoActivity(address));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm font-semibold text-leaf hover:underline">
        ← Look up another
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[3fr_2fr]">
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
            <p className="font-mono text-sm opacity-70">{shortAddress(address)}</p>
            <h1 className="font-display text-4xl capitalize">{growth.stage}</h1>
            <p className="mt-1 opacity-80">
              Growth {growth.score} / 100
              {growth.wilt > 0 && " · wilting, it has been quiet a while"}
            </p>
          </div>

          <GrowthBars growth={growth} />

          <TipPanel address={address} />

          <p className="rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
            <strong>Demo data.</strong> This plant is generated from the address, not from real
            Mezo activity. Real chain data comes with the indexer.
          </p>
        </section>
      </div>
    </main>
  );
}
