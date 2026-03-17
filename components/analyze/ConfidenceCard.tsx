"use client";

import { Database } from "lucide-react";

type ConfidenceCardProps = {
  confidenceScore: number | null;
  confidenceLabel: string | null;
  sampleSize: number | null;
};

export function ConfidenceCard({
  confidenceScore,
  confidenceLabel,
  sampleSize,
}: ConfidenceCardProps) {
  let badgeLabel: string;
  let badgeClass: string;

  if (confidenceScore != null && confidenceScore >= 70) {
    badgeLabel = "Vysoká";
    badgeClass = "bg-emerald-50 text-emerald-700";
  } else if (confidenceScore != null && confidenceScore >= 40) {
    badgeLabel = "Střední";
    badgeClass = "bg-amber-50 text-amber-700";
  } else {
    badgeLabel = "Nízká";
    badgeClass = "bg-red-50 text-red-700";
  }

  const confidenceText =
    confidenceScore != null ? `${confidenceScore.toFixed(0)} %` : "–";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Spolehlivost analýzy
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass}`}
        >
          {confidenceLabel ?? badgeLabel}
        </span>
      </div>

      {/* Circular-style progress — hlavní číslo */}
      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {confidenceText}
        </p>
        <p className="mb-1 text-[11px] text-slate-500">spolehlivost</p>
      </div>

      {/* Visual bar */}
      <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${
            confidenceScore != null && confidenceScore >= 70
              ? "bg-emerald-400"
              : confidenceScore != null && confidenceScore >= 40
                ? "bg-amber-400"
                : "bg-red-400"
          }`}
          style={{ width: `${confidenceScore ?? 0}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] text-slate-400">Vzorků</p>
          <p className="text-sm font-semibold text-slate-800">
            {sampleSize?.toLocaleString("cs-CZ") ?? "–"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] text-slate-400">Doporučení</p>
          <p
            className={`text-sm font-semibold ${
              confidenceScore != null && confidenceScore >= 70
                ? "text-emerald-600"
                : confidenceScore != null && confidenceScore >= 40
                  ? "text-amber-600"
                  : "text-red-600"
            }`}
          >
            {confidenceScore != null && confidenceScore >= 70
              ? "Spolehlivé"
              : confidenceScore != null && confidenceScore >= 40
                ? "Orientační"
                : "S rezervou"}
          </p>
        </div>
      </div>
    </div>
  );
}
