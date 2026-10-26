import Link from "next/link";
import { LookupForm } from "@/components/LookupForm";
import { PlantPlayer } from "@/components/PlantPlayer";
import { computeGrowth } from "@/lib/score";

// A sample plant for the hero. Not any real wallet.
const sample = computeGrowth({
  tradeFeesMusd: 120,
  poolsTraded: 3,
  healthyDebtMusdDays: 70_000,
  savedMusdDays: 30_000,
  weeksActive: 14,
  weeksSinceActive: 0,
});

const ways = [
  { title: "Trade", body: "Counted by the fees you pay on swaps, not by raw volume. Fake volume costs real money, so it doesn't pay." },
  { title: "Borrow", body: "MUSD debt you hold over time, with a healthy collateral ratio. Careful, steady borrowing grows the plant." },
  { title: "Save", body: "Balance kept in the savings vault or locked, weighted by how long it stays. Time matters more than size." },
  { title: "Keep coming back", body: "Weeks you've been active become roots. Go quiet and the plant slowly wilts. Come back and it recovers." },
];

const steps = [
  { title: "Look", body: "Open anyone's garden from a wallet address. No account needed." },
  { title: "Join", body: "Connect a wallet and claim a handle. It's one small transaction, and you can delete it any time." },
  { title: "Tip", body: "Thank a builder or a helpful neighbour with MUSD. It goes straight to their wallet." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-leaf">For people on Mezo</p>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            Every wallet that shows up on Mezo grows a plant.
          </h1>
          <p className="max-w-lg text-lg opacity-80">
            SatSeed is a public record of how people take part in Mezo. Borrow, trade, save and keep coming back, and
            your plant grows. Stop, and it wilts. Anyone can see it, and anyone can tip it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/join" className="rounded-xl bg-leaf px-6 py-3 font-semibold text-cream hover:opacity-90">
              Plant yours
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-ink/25 px-6 py-3 font-semibold hover:border-leaf"
            >
              See the garden
            </Link>
          </div>
        </div>
        <PlantPlayer
          trade={sample.trade}
          borrow={sample.borrow}
          save={sample.save}
          roots={sample.roots}
          wilt={sample.wilt}
          score={sample.score}
        />
      </section>

      <section className="border-y border-ink/10 bg-ink/[0.03]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-3xl">What makes a plant grow</h2>
          <p className="mt-2 max-w-2xl opacity-80">
            Growth follows real activity that costs money, time or risk. Clicks and sign-ups don&apos;t count.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ways.map((w) => (
              <li key={w.title} className="rounded-2xl border border-ink/15 p-5">
                <h3 className="font-display text-xl">{w.title}</h3>
                <p className="mt-2 text-sm opacity-80">{w.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf font-bold text-cream">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-xl">{s.title}</h3>
                <p className="mt-1 text-sm opacity-80">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6">
        <div className="grid gap-8 rounded-3xl border border-ink/15 p-6 sm:p-10 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-display text-3xl">Your data, your choice</h2>
            <p className="opacity-80">
              Everything a plant shows is already public on the chain. Only people who claim a garden get a personal
              page with a handle. Linking anything else is optional, and you can delete your garden whenever you like.
              SatSeed never holds your funds and has no token.
            </p>
            <p className="rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm">
              <strong>Early preview.</strong> Plants currently use demo data generated from the address. Real Mezo
              activity arrives with the indexer.
            </p>
          </div>
          <div className="self-center">
            <LookupForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-ink/10 py-6 text-center text-sm opacity-70">SatSeed · built for the Mezo community</footer>
    </main>
  );
}
