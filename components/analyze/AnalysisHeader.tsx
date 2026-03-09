"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Filter } from "lucide-react";
import { fromEngineKey, normalizeEngineParam } from "@/lib/analyze/engineKeys";

function modelLabelFromParam(model: string | null): string | null {
  if (!model) return null;
  const mapping: Record<string, string> = {
    octavia: "Škoda Octavia",
    superb: "Škoda Superb",
    fabia: "Škoda Fabia",
  };
  if (mapping[model]) return mapping[model];
  return model
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AnalysisHeader() {
  const searchParams = useSearchParams();

  const { vehicleSummary, confidence } = useMemo(() => {
    const brand = searchParams.get("brand");
    const model = searchParams.get("model");
    const yearFrom = searchParams.get("yearFrom");
    const yearTo = searchParams.get("yearTo");
    const engine = searchParams.get("engine");

    const modelLabel = modelLabelFromParam(model);
    const yearLabel =
      yearFrom && yearTo ? `${yearFrom}–${yearTo}` : yearFrom ?? yearTo ?? null;

    const parts: string[] = [];
    if (brand) parts.push(brand);
    if (modelLabel) parts.push(modelLabel);
    if (yearLabel) parts.push(yearLabel);
    if (engine) parts.push(fromEngineKey(normalizeEngineParam(engine)) ?? engine);

    return {
      vehicleSummary: parts.length > 0 ? parts.join(" · ") : null,
      confidence: 92,
    };
  }, [searchParams]);

  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:px-6 lg:px-8"
      aria-label="Hlavička analýzy"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 transition-colors hover:text-sky-600"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">
              <span className="text-sm font-bold">A</span>
            </span>
            AutoTempest
          </Link>
          <span
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
            aria-current="page"
          >
            Analýza trhu
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {vehicleSummary ? (
            <span className="hidden rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700 sm:inline-block">
              {vehicleSummary}
            </span>
          ) : (
            <span className="hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 sm:inline-block">
              Zvolte segment
            </span>
          )}
          <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-sky-700">
            {confidence} %
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-sky-600"
            aria-label="Filtrovat"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtrovat</span>
          </button>
        </div>
      </div>
    </header>
  );
}
