import { LookupForm } from "@/components/LookupForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-6">
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-leaf">Mezo</p>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">
          Every wallet that shows up on Mezo grows a plant.
        </h1>
        <p className="max-w-xl text-lg opacity-80">
          Trade, borrow, save and keep coming back. The plant grows with real activity and wilts
          when it goes quiet. Paste any address to see its garden.
        </p>
      </div>
      <LookupForm />
    </main>
  );
}
