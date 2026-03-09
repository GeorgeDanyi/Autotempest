"use client";

import { useMemo } from "react";
import { formatCurrencyCZK } from "@/lib/ui";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING, CARD_LABEL } from "@/components/analyze/cardStyles";
import type { SharedAnalysisResult } from "@/lib/pricing/types";

type PriceRadarCardProps = {
  analysisResult: SharedAnalysisResult | null;
};

export function PriceRadarCard({ analysisResult }: PriceRadarCardProps) {
  const { medianPrice, positionPct, minLabel, maxLabel, hasData } = useMemo(() => {
    const median = analysisResult?.median_price_czk ?? null;
    const p25 = analysisResult?.p25_price_czk ?? null;
    const p75 = analysisResult?.p75_price_czk ?? null;
    if (median == null || p25 == null || p75 == null || !Number.isFinite(median) || !Number.isFinite(p25) || !Number.isFinite(p75)) {
      return { medianPrice: 0, positionPct: 50, minLabel: 0, maxLabel: 0, hasData: false };
    }
    const lowApprox = Math.max(Math.round(p25 - (median - p25)), 0);
    const highApprox = Math.round(p75 + (p75 - median));
    const span = Math.max(highApprox - lowApprox, 1);
    const positionPct = Math.min(100, Math.max(0, ((median - lowApprox) / span) * 100));
    return { medianPrice: median, positionPct, minLabel: lowApprox, maxLabel: highApprox, hasData: true };
  }, [analysisResult]);

  if (!hasData) {
    return (
      <section aria-label="Cenový radar" className={`${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}>
        <p className={CARD_LABEL}>Cenový radar</p>
        <p className="mt-2 text-sm text-slate-500">Vyberte model pro zobrazení.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Cenový radar"
      className={`${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <p className={CARD_LABEL}>Cenový radar</p>
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">
            {formatCurrencyCZK(medianPrice)}
          </span>
        </div>

        <div className="relative w-full">
          <div
            className="h-2 w-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-rose-400"
            aria-hidden
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-300 ease-out"
            style={{ left: `${positionPct}%` }}
          >
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.15)]" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="font-mono tabular-nums">{formatCurrencyCZK(minLabel)}</span>
          <span className="text-slate-400">Levné · Férové · Vysoké</span>
          <span className="font-mono tabular-nums">{formatCurrencyCZK(maxLabel)}</span>
        </div>
      </div>
    </section>
  );
}
