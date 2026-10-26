"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/join", label: "Join" },
  { href: "/me", label: "My garden" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-ink/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M12 12C12 7 8 5 4 5c0 5 3 7 8 7Z" className="fill-leaf-soft" />
            <path d="M12 10c0-4 3-6 8-6 0 5-3 7-8 6Z" className="fill-leaf" />
          </svg>
          SatSeed
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full gap-5 text-sm font-semibold sm:order-none sm:w-auto">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={active ? "text-leaf underline underline-offset-4" : "opacity-75 hover:opacity-100"}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
