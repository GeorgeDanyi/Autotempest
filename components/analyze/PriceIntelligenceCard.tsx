"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Banknote } from "lucide-react";
import { formatCurrencyCZK } from "@/lib/ui";

function deriveTitleFromQuery(q: string | null): string {
  if (!q) return "Segment trhu";
  return q.length > 40 ? `${q.slice(0, 37)}…` : q;
}

export function PriceIntelligenceCard() {
  const searchParams = useSearchParams();
  const title = useMemo(
    () => deriveTitleFromQuery(searchParams.get("q")),
    [searchParams]
  );

  const mockFairPrice = 359_000;
  const confidence = 92;

  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 p-6 shadow-lg transition-shadow hover:shadow-xl sm:p-7 lg:p-8" aria-label="Férová cena">
      <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
        <Banknote className="h-5 w-5 text-white" />
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-100">
        Férová cena
      </p>
      <p
        className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-[2.6rem]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {formatCurrencyCZK(mockFairPrice)}
      </p>
      {title && (
        <p className="mt-1 text-xs text-sky-100/90">{title}</p>
      )}
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/90">
        Confidence · {confidence} %
      </p>
    </div>
  );
}
