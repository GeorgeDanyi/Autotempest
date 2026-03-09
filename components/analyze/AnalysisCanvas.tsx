"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AnalyzeSearchBar } from "@/components/analyze/AnalyzeSearchBar";
import { PriceIntelligenceCard } from "@/components/analyze/PriceIntelligenceCard";
import { DealScoreCard } from "@/components/analyze/DealScoreCard";
import { MarketInsightCard } from "@/components/analyze/MarketInsightCard";
import { ConfidenceCard } from "@/components/analyze/ConfidenceCard";
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

function engineLabelFromParam(engine: string | null): string | null {
  if (!engine) return null;
  const key = normalizeEngineParam(engine);
  return fromEngineKey(key) ?? (key ? key.replace(/_/g, " ").toUpperCase() : null);
}

export function AnalysisCanvas() {
  const searchParams = useSearchParams();

  const context = useMemo(() => {
    const modelParam = searchParams.get("model");
    const yearFrom = searchParams.get("yearFrom");
    const yearTo = searchParams.get("yearTo");
    const engineParam = searchParams.get("engine");
    const yearLabel =
      yearFrom && yearTo ? `${yearFrom}–${yearTo}` : yearFrom ?? yearTo ?? null;

    return {
      modelLabel: modelLabelFromParam(modelParam),
      yearLabel,
      engineLabel: engineLabelFromParam(engineParam),
    };
  }, [searchParams]);

  return (
    <section
      aria-label="Primary analysis canvas"
      className="relative"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)] lg:items-start">
        {/* Main canvas: query + price intelligence card */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200/70 bg-white/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.9)_inset,0_2px_12px_-4px_rgba(15,23,42,0.06)]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Query or paste listing URL
            </p>
            <AnalyzeSearchBar className="w-full" />
          </div>
          <PriceIntelligenceCard />
        </div>

        {/* Right rail: stacked intelligence modules */}
        <div className="flex flex-col gap-4 lg:pt-0">
          <DealScoreCard
            modelLabel={context.modelLabel}
            yearLabel={context.yearLabel}
            engineLabel={context.engineLabel}
          />
          <MarketInsightCard modelLabel={context.modelLabel} />
          <ConfidenceCard />
        </div>
      </div>
    </section>
  );
}
