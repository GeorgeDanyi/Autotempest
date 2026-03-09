"use client";

import { Award } from "lucide-react";
import { ANALYZE_CARD, CARD_LABEL } from "@/components/analyze/cardStyles";

const DEAL_LABEL_MAP: Record<string, string> = {
  GREAT_DEAL: "Skvělý deal",
  GOOD_DEAL: "Dobrý deal",
  FAIR: "Férová cena",
  OVERPRICED: "Nad cenu",
  VERY_OVERPRICED: "Výrazně nad cenu",
  UNKNOWN: "–",
  top_deal: "Skvělý deal",
  good: "Dobrý deal",
  fair: "Férová cena",
  overpriced: "Nad cenu",
  unknown: "–",
};

type DealScoreCardProps = {
  modelLabel: string | null;
  yearLabel: string | null;
  engineLabel: string | null;
  dealScore?: number | null;
  dealLabel?: string | null;
};

export function DealScoreCard({
  modelLabel,
  yearLabel,
  engineLabel,
  dealScore,
  dealLabel,
}: DealScoreCardProps) {
  const hasScore = dealScore != null && Number.isFinite(dealScore);
  const displayScore = hasScore ? (dealScore / 10).toFixed(1) : "–";
  const displayLabel = dealLabel ? (DEAL_LABEL_MAP[dealLabel] ?? dealLabel) : "–";

  return (
    <div
      className={`flex h-full min-h-0 flex-col p-6 sm:p-7 ${ANALYZE_CARD}`}
      aria-label="Skóre nabídek"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-slate-600">
          <Award className="h-5 w-5" />
        </div>
        {displayLabel !== "–" && (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
            {displayLabel}
          </span>
        )}
      </div>
      <p className={`mt-4 ${CARD_LABEL}`}>
        Skóre nabídek
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
        {displayScore}
        <span className="text-xs font-medium text-slate-500">/10</span>
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {hasScore ? "Zadejte cenu inzerátu pro skóre konkrétní nabídky." : "Vyberte konkrétní inzerát pro skóre."}
      </p>
      {(modelLabel || yearLabel || engineLabel) && (
        <p className="mt-1 truncate text-[11px] text-slate-400">
          {[modelLabel, yearLabel, engineLabel].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
