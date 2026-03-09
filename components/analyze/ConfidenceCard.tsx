"use client";

import { Database, TrendingUp } from "lucide-react";

export function ConfidenceCard() {
  const confidence = 92;
  const sampleSize = 1863;
  const trend = "+4,5 %";
  const prev = "88 %";

  return (
    <div
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
      aria-label="Kvalita dat"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50">
          <Database className="h-5 w-5 text-sky-600" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
          <TrendingUp className="h-3 w-3" />
          {trend}
        </span>
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        Kvalita dat
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {confidence} %
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Minulý měsíc {prev} · {sampleSize.toLocaleString("cs-CZ")} inzerátů
      </p>
    </div>
  );
}
