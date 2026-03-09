"use client";

import { useMemo } from "react";
import { StatPill } from "@/components/price-trends/StatPill";
import { formatCurrencyCZK } from "@/lib/ui";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import type { SharedAnalysisResult } from "@/lib/pricing/types";

type PriceDistributionCardProps = {
  analysisResult: SharedAnalysisResult | null;
};

export function PriceDistributionCard({ analysisResult }: PriceDistributionCardProps) {
  const { minPrice, maxPrice, medianPrice, medianRatio, hasData } = useMemo(() => {
    const min = analysisResult?.min_price_czk ?? null;
    const max = analysisResult?.max_price_czk ?? null;
    const median = analysisResult?.median_price_czk ?? null;
    if (min == null || max == null || median == null || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(median)) {
      return { minPrice: 0, maxPrice: 0, medianPrice: 0, medianRatio: 0.5, hasData: false };
    }
    const span = max - min || 1;
    return {
      minPrice: min,
      maxPrice: max,
      medianPrice: median,
      medianRatio: (median - min) / span,
      hasData: true,
    };
  }, [analysisResult]);

  if (!hasData) {
    return (
      <div className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`} aria-label="Rozložení cen">
        <h3 className="text-sm font-semibold tracking-tight text-slate-800">Rozložení cen</h3>
        <p className="mt-2 text-sm text-slate-500">Vyberte model pro zobrazení.</p>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      aria-label="Rozložení cen"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-slate-800">
            Rozložení cen
          </h3>
          <p className="text-[11px] text-slate-500">
            Nízké · Férové · Vysoké
          </p>
        </div>
        <StatPill
          label="Medián"
          value={formatCurrencyCZK(medianPrice)}
          tone="info"
        />
      </div>

      <div className="mt-6 flex-1 rounded-xl bg-slate-50/70 p-5">
        <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-emerald-100/90" />
          <div className="absolute inset-y-0 left-1/3 w-1/3 bg-sky-100/90" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-rose-100/90" />
          <div
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
            style={{ left: `calc(${medianRatio * 100}% - 10px)` }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium text-slate-500">
          <span>Nízké</span>
          <span>Férové</span>
          <span>Vysoké</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-800">
          <span>{formatCurrencyCZK(minPrice)}</span>
          <span>{formatCurrencyCZK(medianPrice)}</span>
          <span>{formatCurrencyCZK(maxPrice)}</span>
        </div>
      </div>
    </div>
  );
}
