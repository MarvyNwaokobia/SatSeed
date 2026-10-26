"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseAddress } from "@/lib/address";

export function LookupForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const address = parseAddress(value);
    if (!address) {
      setError("That doesn't look like a valid wallet address.");
      return;
    }
    setError(null);
    router.push(`/garden/${address}`);
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xl" noValidate>
      <label htmlFor="address" className="mb-2 block text-sm font-semibold">
        Look up a wallet
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="address"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "address-error" : undefined}
          className="min-w-0 flex-1 rounded-xl border border-ink/20 bg-transparent px-4 py-3 font-mono text-sm outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/30"
        />
        <button
          type="submit"
          className="rounded-xl bg-leaf px-6 py-3 font-semibold text-cream transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          See the garden
        </button>
      </div>
      {error && (
        <p id="address-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
