"use client";

import { Gauge, Activity } from "lucide-react";
import { formatCurrencyCZK } from "@/lib/ui";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING, CARD_LABEL, CARD_TITLE, CARD_DESC } from "@/components/analyze/cardStyles";
import type { SharedAnalysisResult } from "@/lib/pricing/types";

type MarketInsightsCardProps = {
  modelLabel: string | null;
  analysisResult: SharedAnalysisResult | null;
};

export function MarketInsightsCard({ modelLabel, analysisResult }: MarketInsightsCardProps) {
  const p25 = analysisResult?.p25_price_czk ?? null;
  const p75 = analysisResult?.p75_price_czk ?? null;
  const sampleSize = analysisResult?.sample_size ?? null;
  const hasData = p25 != null && p75 != null && Number.isFinite(p25) && Number.isFinite(p75);

  return (
    <div
      className={`${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      aria-label="Tržní insight"
    >
      <p className={CARD_LABEL}>Tržní insight</p>
      <h3 className={`mt-2 ${CARD_TITLE}`}>
        {modelLabel ? `${modelLabel} na trhu` : "Segment na trhu"}
      </h3>
      <ul className={`mt-5 space-y-2.5 ${CARD_DESC}`}>
        <li className="flex gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
          <span>
            {hasData ? (
              <>Většina nabídek <span className="font-semibold text-slate-800">{formatCurrencyCZK(p25)}–{formatCurrencyCZK(p75)}</span></>
            ) : (
              "Vyberte model pro zobrazení rozptylu cen."
            )}
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
          <span>Trh likvidní, nabídka roste.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
          <span>Vyjednávací prostor mírně větší.</span>
        </li>
      </ul>

      <dl className="mt-6 grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <dt className={`flex items-center gap-1.5 ${CARD_LABEL}`}><Gauge className="h-3 w-3" /> Rozptyl</dt>
          <dd className="font-mono text-xs font-semibold tabular-nums text-slate-800">
            {hasData ? `${formatCurrencyCZK(p25)}–${formatCurrencyCZK(p75)}` : "–"}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className={`flex items-center gap-1.5 ${CARD_LABEL}`}><Activity className="h-3 w-3" /> Vzorek</dt>
          <dd className="font-mono text-xs font-semibold tabular-nums text-slate-800">
            {sampleSize != null ? `${sampleSize.toLocaleString("cs-CZ")} inz.` : "–"}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className={CARD_LABEL}>Volatilita</dt>
          <dd className="text-xs font-semibold text-slate-800">Nízká</dd>
        </div>
      </dl>
    </div>
  );
}
