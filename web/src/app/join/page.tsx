import type { Metadata } from "next";
import { JoinFlow } from "@/components/JoinFlow";

export const metadata: Metadata = { title: "Join · SatSeed" };

export default function Join() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl">Plant your garden</h1>
      <p className="mt-2 mb-10 opacity-80">
        Claim a handle for your wallet. It takes a minute, and your plant starts growing from what you already do on
        Mezo.
      </p>
      <JoinFlow />
    </main>
  );
}
