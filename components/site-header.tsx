"use client"

import Link from "next/link"

import { Container } from "@/components/layout/primitives"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <Container className="flex h-14 items-center justify-between gap-4 sm:h-16">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 text-[11px] font-bold text-white shadow-[0_10px_30px_rgba(79,70,229,0.45)]">
            AT
          </span>
          <span className="flex items-baseline gap-1 text-base md:text-lg">
            <span className="font-semibold text-neutral-900">
              AutoTempest
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              CZ
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full bg-neutral-50/80 p-1 text-[11px] font-medium text-neutral-500 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:flex md:text-xs">
          <a
            href="#hero"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-neutral-700 transition-colors hover:bg-white hover:text-neutral-900"
          >
            Přehled
          </a>
          <a
            href="#dashboard"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900"
          >
            Dashboard
          </a>
          <a
            href="#deals"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900"
          >
            Nabídky
          </a>
          <a
            href="#method"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900"
          >
            Metodika
          </a>
        </nav>
      </Container>
    </header>
  )
}

