"use client";

import { Users } from "lucide-react";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING, CARD_LABEL } from "@/components/analyze/cardStyles";
import type { SharedAnalysisResult } from "@/lib/pricing/types";

type MarketInsightsCardProps = {
  modelLabel: string | null;
  analysisResult: SharedAnalysisResult | null;
  sampleSize: number | null;
};

export function MarketInsightsCard({
  modelLabel,
  analysisResult,
  sampleSize,
}: MarketInsightsCardProps) {
  const effectiveSampleSize =
    sampleSize ?? analysisResult?.sample_size ?? null;

  let value: string;
  let description: string;
  let badgeClass: string;

  if (effectiveSampleSize != null && effectiveSampleSize >= 50) {
    value = "Aktivní trh";
    description = "Dostatek nabídek pro spolehlivou analýzu.";
    badgeClass = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  } else if (effectiveSampleSize != null && effectiveSampleSize >= 20) {
    value = "Běžný trh";
    description = "Průměrná nabídka pro tento segment.";
    badgeClass = "bg-sky-50 text-sky-700 ring-sky-200";
  } else if (effectiveSampleSize != null && effectiveSampleSize >= 5) {
    value = "Řídký trh";
    description = "Méně nabídek — ceny mohou kolísat.";
    badgeClass = "bg-amber-50 text-amber-700 ring-amber-200";
  } else {
    value = "Velmi málo dat";
    description = "Nedostatek dat pro spolehlivý odhad.";
    badgeClass = "bg-red-50 text-red-700 ring-red-200";
  }

  const badgeLabel =
    effectiveSampleSize != null ? `${effectiveSampleSize} inz.` : "–";

  return (
    <div className={`${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={CARD_LABEL}>Likvidita trhu</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-1.5 w-full rounded-full bg-slate-100">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              effectiveSampleSize != null && effectiveSampleSize >= 50
                ? "bg-emerald-400"
                : effectiveSampleSize != null && effectiveSampleSize >= 20
                  ? "bg-sky-400"
                  : effectiveSampleSize != null && effectiveSampleSize >= 5
                    ? "bg-amber-400"
                    : "bg-red-400"
            }`}
            style={{
              width: `${Math.min(
                100,
                ((effectiveSampleSize ?? 0) / 100) * 100,
              )}%`,
            }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Inzerátů
          </p>
          <p className="mt-0.5 text-base font-bold text-slate-800">
            {effectiveSampleSize?.toLocaleString("cs-CZ") ?? "–"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Volatilita
          </p>
          <p
            className={`mt-0.5 text-base font-bold ${
              effectiveSampleSize != null && effectiveSampleSize >= 50
                ? "text-emerald-600"
                : effectiveSampleSize != null && effectiveSampleSize >= 20
                  ? "text-sky-600"
                  : "text-amber-600"
            }`}
          >
            {effectiveSampleSize != null && effectiveSampleSize >= 50
              ? "Nízká"
              : effectiveSampleSize != null && effectiveSampleSize >= 20
                ? "Střední"
                : "Vysoká"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">{description}</p>
    </div>
  );
}
