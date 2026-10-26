import type { Metadata } from "next";
import { MyGarden } from "@/components/MyGarden";

export const metadata: Metadata = { title: "My garden · SatSeed" };

export default function Me() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="mb-8 font-display text-4xl">My garden</h1>
      <MyGarden />
    </main>
  );
}
