"use client";

import { TrendingDown, Users } from "lucide-react";

type MarketInsightCardProps = {
  modelLabel: string | null;
};

export function MarketInsightCard({ modelLabel }: MarketInsightCardProps) {
  const value = "Stabilní";
  const trend = "+2,1 %";
  const prev = "Typický trh";

  return (
    <div
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
      aria-label="Stav trhu"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Users className="h-5 w-5 text-slate-600" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          <TrendingDown className="h-3 w-3" />
          {trend}
        </span>
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        Stav trhu
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        {prev}
        {modelLabel ? ` · ${modelLabel}` : ""}
      </p>
    </div>
  );
}
