"use client";

import { Award } from "lucide-react";
import { ANALYZE_CARD, CARD_LABEL } from "@/components/analyze/cardStyles";

type DealScoreCardProps = {
  modelLabel: string | null;
  yearLabel: string | null;
  engineLabel: string | null;
  dealScore?: number | null;
  dealLabel?: string | null;
  medianPrice?: number | null;
  p25Price?: number | null;
};

export function DealScoreCard({
  modelLabel,
  yearLabel,
  engineLabel,
  dealScore,
  dealLabel,
  medianPrice,
  p25Price,
}: DealScoreCardProps) {
  const negotiationRoom =
    medianPrice && p25Price
      ? Math.round(((medianPrice - p25Price) / medianPrice) * 100)
      : null;

  const suggestedOffer =
    medianPrice && p25Price
      ? Math.round((medianPrice + p25Price) / 2)
      : null;

  return (
    <div className={`flex h-full flex-col p-6 sm:p-7 ${ANALYZE_CARD}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={CARD_LABEL}>Vyjednávací pozice</p>
        {negotiationRoom != null && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
              negotiationRoom >= 15
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : negotiationRoom >= 8
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-slate-50 text-slate-600 ring-slate-200"
            }`}
          >
            {negotiationRoom >= 15
              ? "Velký"
              : negotiationRoom >= 8
                ? "Střední"
                : "Malý"}
          </span>
        )}
      </div>

      {negotiationRoom != null && suggestedOffer != null ? (
        <>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            −{negotiationRoom} %
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            pod mediánem trhu
          </p>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Doporučená nabídka
            </p>
            <p className="mt-1 text-lg font-bold text-sky-600">
              {suggestedOffer.toLocaleString("cs-CZ")} Kč
            </p>
            <p className="text-[11px] text-slate-500">
              Průměr mezi mediánem a spodním kvartilem
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-400">
            –
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Zadejte model pro zobrazení prostoru pro vyjednávání.
          </p>
        </>
      )}

      {(modelLabel || yearLabel) && (
        <p className="mt-3 truncate text-[11px] text-slate-400">
          {[modelLabel, yearLabel, engineLabel].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
