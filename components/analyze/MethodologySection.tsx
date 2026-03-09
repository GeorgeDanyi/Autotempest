"use client";

import { Database, Filter as FilterIcon, Sigma, Sparkles } from "lucide-react";
import { ANALYZE_CARD } from "@/components/analyze/cardStyles";

export function MethodologySection() {
  return (
    <section
      aria-labelledby="methodology-title"
      className="space-y-6 border-t border-slate-200/70 pt-10"
    >
      <div>
        <p
          id="methodology-title"
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400"
        >
          Metodika
        </p>
        <h2 className="mt-2 text-sm font-semibold tracking-tight text-slate-800">
          Jak počítáme férovou cenu
        </h2>
        <p className="mt-1.5 max-w-xl text-[11px] text-slate-500 leading-snug">
          Robustní statistika, český trh. Transparentní a reprodukovatelné.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`flex items-start gap-3 p-5 ${ANALYZE_CARD}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-slate-600">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              1. Sbíráme inzeráty
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              Data z portálů, normalizované modely.
            </p>
          </div>
        </div>

        <div className={`flex items-start gap-3 p-5 ${ANALYZE_CARD}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-slate-600">
            <FilterIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              2. Čistíme odlehlé hodnoty
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              Podezřelé ceny, duplicity, chyby.
            </p>
          </div>
        </div>

        <div className={`flex items-start gap-3 p-5 ${ANALYZE_CARD}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-slate-600">
            <Sigma className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              3. Počítáme statistiky
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              Medián, percentily, vážení, trendy.
            </p>
          </div>
        </div>

        <div className={`flex items-start gap-3 p-5 ${ANALYZE_CARD}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-slate-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              4. Férové pásmo
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              Cena a rozpětí dle trhu.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
