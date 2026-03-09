import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { MainContent } from "@/components/layout/MainContent";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoTempest CZ",
  description: "Moderní agregátor inzerce aut pro český trh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[radial-gradient(circle_at_top,_#e2ecff_0,_#f9fafb_42%,_#ffffff_100%)] text-neutral-900`}
      >
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1 overflow-x-hidden">
            <MainContent>{children}</MainContent>
          </main>
        </div>
      </body>
    </html>
  );
}
