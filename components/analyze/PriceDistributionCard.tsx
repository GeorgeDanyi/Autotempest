"use client";

import { useMemo } from "react";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import type { SharedAnalysisResult } from "@/lib/pricing/types";

type PriceDistributionCardProps = {
  analysisResult: SharedAnalysisResult | null;
};

export function PriceDistributionCard({ analysisResult }: PriceDistributionCardProps) {
  const { buckets, medianPrice, p25Price, p75Price, hasData } = useMemo(() => {
    const min = analysisResult?.min_price_czk ?? null;
    const max = analysisResult?.max_price_czk ?? null;
    const median = analysisResult?.median_price_czk ?? null;
    const p25 = analysisResult?.p25_price_czk ?? null;
    const p75 = analysisResult?.p75_price_czk ?? null;
    const sample = analysisResult?.sample_size ?? null;

    if (!min || !max || !median || !p25 || !p75 || !sample || sample < 3) {
      return { buckets: [], medianPrice: 0, p25Price: 0, p75Price: 0, hasData: false };
    }

    const bucketWidth = Math.ceil((max - min) / 6 / 10000) * 10000 || 10000;
    const start = Math.floor(min / 10000) * 10000;

    const rawBuckets = Array.from({ length: 6 }, (_, i) => ({
      from: start + i * bucketWidth,
      to: start + (i + 1) * bucketWidth,
      count: 0,
    }));

    rawBuckets.forEach((b) => {
      const center = (b.from + b.to) / 2;
      const distance = Math.abs(center - median);
      const sigma = (p75 - p25) / 1.35;
      b.count = Math.max(
        1,
        Math.round(
          sample *
            (1 / (sigma * Math.sqrt(2 * Math.PI))) *
            Math.exp(-0.5 * Math.pow(distance / sigma, 2)) *
            bucketWidth
        )
      );
    });

    const maxCount = Math.max(...rawBuckets.map((b) => b.count));

    return {
      buckets: rawBuckets.map((b) => ({ ...b, ratio: b.count / maxCount })),
      medianPrice: median,
      p25Price: p25,
      p75Price: p75,
      hasData: true,
    };
  }, [analysisResult]);

  if (!hasData) {
    return (
      <div className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}>
        <p className="text-sm font-semibold text-slate-800">Rozložení cen</p>
        <p className="mt-2 text-sm text-slate-500">Vyberte model pro zobrazení.</p>
      </div>
    );
  }

  const fmt = (n: number) => `${Math.round(n / 1000)}k`;

  return (
    <div className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-800">
            Rozložení cen
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Kde se koncentrují inzeráty
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200">
          Medián {fmt(medianPrice)} Kč
        </span>
      </div>

      <div className="mt-5 flex flex-1 items-end gap-1.5">
        {buckets.map((b, i) => {
          const isMedianBand = b.from <= medianPrice && b.to > medianPrice;
          const isFairBand = b.from >= p25Price && b.to <= p75Price + 1;
          const isLowBand = b.to <= p25Price;

          const barColor = isMedianBand
            ? "bg-sky-400"
            : isFairBand
            ? "bg-sky-200"
            : isLowBand
            ? "bg-emerald-200"
            : "bg-rose-200";

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-sm transition-all duration-500 ${barColor}`}
                style={{ height: `${Math.max(8, b.ratio * 80)}px` }}
              />
              <span className="text-[9px] text-slate-400 leading-tight text-center whitespace-nowrap">
                {fmt(b.from)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-emerald-200" />
          Levné
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-sky-200" />
          Férové pásmo
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm bg-rose-200" />
          Vysoké
        </div>
      </div>
    </div>
  );
}
