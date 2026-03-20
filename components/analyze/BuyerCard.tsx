"use client";

import { ANALYZE_CARD, CARD_LABEL } from "@/components/analyze/cardStyles";
import { roundToNearest } from "@/lib/ui";
import { getSampleTier } from "@/lib/ui/sampleSize";

type BuyerCardProps = {
  medianPrice: number | null;
  p25Price: number | null;
  p75Price: number | null;
  sampleSize: number | null;
  modelLabel: string | null;
  yearLabel: string | null;
};

export function BuyerCard({
  medianPrice,
  p25Price,
  p75Price,
  sampleSize,
}: BuyerCardProps) {
  // Realistický prostor pro vyjednávání — max 12 %
  const rawNegotiationRoom =
    medianPrice != null && p25Price != null
      ? ((medianPrice - p25Price) / medianPrice) * 100
      : null;
  const negotiationRoom =
    rawNegotiationRoom != null ? Math.min(12, Math.round(rawNegotiationRoom)) : null;

  // Doporučená nabídka — 5 až 8 % pod mediánem
  const suggestedOffer =
    medianPrice != null && negotiationRoom != null
      ? Math.round(
          medianPrice *
            (1 - Math.min(0.08, (negotiationRoom / 100) * 0.7)),
        )
      : null;

  // Realistické minimum — max 10 % pod mediánem
  const minimumOffer =
    medianPrice != null && negotiationRoom != null
      ? Math.round(
          medianPrice *
            (1 - Math.min(0.1, (negotiationRoom / 100) * 0.9)),
        )
      : null;

  const sampleTier = getSampleTier(sampleSize ?? 0);
  const priceSpread =
    p75Price != null && p25Price != null && p25Price > 0
      ? p75Price / p25Price
      : 1;

  let argumentText: string;
  if (sampleTier === "small") {
    argumentText =
      "Specifický segment — při vyjednávání se zaměřte na historii vozu a servisní záznamy spíše než na srovnávání cen.";
  } else if (sampleTier === "medium" && priceSpread > 1.5) {
    argumentText = `Rozpětí férového pásma (${Math.round(
      (p25Price ?? 0) / 1000,
    )}k – ${Math.round(
      (p75Price ?? 0) / 1000,
    )}k Kč) ukazuje na nevyzpytatelný trh. Trvejte na důkladné technické prohlídce.`;
  } else if (sampleTier === "medium") {
    argumentText = `Ceny jsou v tomto segmentu stabilní — férová nabídka je kolem ${
      p25Price != null ? Math.round(p25Price / 1000) : "…"
    }k Kč.`;
  } else {
    argumentText = `Silný trh s ${
      sampleSize ?? 0
    } vozy — srovnej více nabídek, máš silnou pozici.`;
  }

  return (
    <div className={`${ANALYZE_CARD} flex h-full flex-col p-6`}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50">
          <svg
            className="h-3.5 w-3.5 text-sky-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <div>
          <p className={`${CARD_LABEL} text-sky-600`}>Kupujete?</p>
          <p className="mt-0.5 text-[11px] text-slate-400">argumenty a doporučení</p>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-slate-100">
        <div className="flex items-baseline justify-between py-2.5">
          <span className="text-[12px] text-slate-500">Doporučená nabídka</span>
          <span className="text-[13px] font-semibold text-sky-600">
            {suggestedOffer != null
              ? `${roundToNearest(suggestedOffer).toLocaleString("cs-CZ")} Kč`
              : "—"}
          </span>
        </div>
        <div className="flex items-baseline justify-between py-2.5">
          <span className="text-[12px] text-slate-500">Realistické minimum</span>
          <span className="text-[13px] font-semibold text-slate-800">
            {minimumOffer != null
              ? `${roundToNearest(minimumOffer).toLocaleString("cs-CZ")} Kč`
              : "—"}
          </span>
        </div>
        <div className="flex items-baseline justify-between py-2.5">
          <span className="text-[12px] text-slate-500">Prostor pro slevu</span>
          <span className="text-[13px] font-semibold text-emerald-600">
            {negotiationRoom != null ? `−${negotiationRoom} %` : "—"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex-1 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-500">
          Argument pro vyjednávání
        </p>
        <p className="text-[11px] leading-relaxed text-sky-700">
          {argumentText}
        </p>
      </div>
    </div>
  );
}
