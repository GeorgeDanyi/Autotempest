"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 ${
        isHome ? "bg-transparent" : "bg-white/90 border-b border-slate-200/60 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-bold text-white">
              AT
            </div>
            <span
              className={`text-sm font-semibold tracking-tight ${
                isHome ? "text-slate-900" : "text-slate-900"
              }`}
            >
              AutoTempest <span className="text-slate-400 font-normal">cz</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/", label: "Přehled" },
              { href: "/analyze", label: "Analyzovat" },
              { href: "/dashboard", label: "Dashboard" },
              { href: "/methodology", label: "Metodika" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-white/40 hover:text-slate-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

