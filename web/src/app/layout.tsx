import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces, Nunito } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SatSeed",
  description: "A living record of how people take part in Mezo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <WalletProvider>
          <Suspense fallback={<div className="h-14 border-b border-ink/10" />}>
            <SiteHeader />
          </Suspense>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
