"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Car, Gauge } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/price-trends/GlassCard";
import { StatPill } from "@/components/price-trends/StatPill";
import { formatCurrencyCZK } from "@/lib/ui";
import { AnalyzeSearchBar } from "@/components/analyze/AnalyzeSearchBar";
import { fromEngineKey, normalizeEngineParam } from "@/lib/analyze/engineKeys";

function deriveTitleFromQuery(q: string | null): string {
  if (!q) return "Vybraný segment trhu";
  return q.length > 60 ? `${q.slice(0, 57)}…` : q;
}

export function AnalyzeHero() {
  const searchParams = useSearchParams();

  const context = useMemo(() => {
    const q = searchParams.get("q");
    const brand = searchParams.get("brand");
    const model = searchParams.get("model");
    const yearFrom = searchParams.get("yearFrom");
    const yearTo = searchParams.get("yearTo");
    const engine = searchParams.get("engine");
    const mileageTo = searchParams.get("mileageTo");
    const fuels = searchParams.get("fuels");

    const chips: string[] = [];
    const yearLabel =
      yearFrom && yearTo
        ? yearFrom === yearTo
          ? yearFrom
          : `${yearFrom}–${yearTo}`
        : yearFrom ?? yearTo ?? null;

    if (brand) chips.push(brand);
    if (model) chips.push(model);
    if (yearLabel) chips.push(`Rok ${yearLabel}`);
    if (engine) chips.push(fromEngineKey(normalizeEngineParam(engine)) ?? engine);
    if (mileageTo) {
      const numeric = Number.parseInt(mileageTo, 10);
      if (!Number.isNaN(numeric)) {
        chips.push(`Nájezd do ${numeric.toLocaleString("cs-CZ")} km`);
      }
    }
    if (fuels) {
      const primaryFuel = fuels.split(",")[0];
      if (primaryFuel) chips.push(primaryFuel);
    }

    return {
      q,
        brand,
        model,
      yearFrom,
      yearTo,
      engine,
        mileageTo,
      title: deriveTitleFromQuery(q),
      chips,
    };
  }, [searchParams]);

  const mockFairPrice = 359_000;
  const mockRange: [number, number] = [344_000, 379_000];
  const mockConfidence = 0.92;
  const mockSampleSize = 1863;

  return (
    <section
      aria-labelledby="analyze-hero-title"
      className="relative grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)] lg:items-start"
    >
      {/* LEFT COLUMN: product copy + search + quick filters */}
      <div className="space-y-5">
        <Badge className="inline-flex items-center gap-2 rounded-full bg-sky-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-[0_12px_40px_rgba(59,130,246,0.32)]">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
            CZ
          </span>
          Price Analysis
        </Badge>

        <div className="space-y-3">
          <h1
            id="analyze-hero-title"
            className="text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-4xl lg:text-[2.5rem]"
          >
            Cockpit pro analýzu férové ceny ojetin
          </h1>
          <p className="max-w-[620px] text-sm leading-[1.6] text-[#64748B] sm:text-base">
            Zadej popis auta nebo vlož odkaz na inzerát. Cockpit dopočítá férovou
            cenu, rozpětí trhu a vytáhne nejlepší nabídky – v jednom přehledném
            rozhraní.
          </p>
        </div>

        <AnalyzeSearchBar className="max-w-xl" />

        {/* Selected car / segment summary + quick parameter chips */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Vybraný segment
          </p>
          <p className="text-xs text-slate-600">
            {context.chips.length > 0 ? (
              <>
                Analýza běží pro segment definovaný níže – můžeš kdykoliv upravit
                značku, model, rok, nájezd nebo palivo.
              </>
            ) : (
              <>
                Zatím obecný trh ojetých aut. Začni zadáním auta nebo úpravou filtrů
                pod tímto blokem.
              </>
            )}
          </p>
          <div className="mt-1 min-h-[24px] flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            {context.chips.length > 0 ? (
              context.chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200"
                >
                  {chip}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-400 ring-1 ring-slate-200">
                Žádné parametry – analyzujeme široký trh
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 shadow-sm backdrop-blur">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <Car className="h-3 w-3" />
            </span>
            <span>Férová cena pro konkrétní model, rok a motor</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 shadow-sm backdrop-blur">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Gauge className="h-3 w-3" />
            </span>
            <span>Konfidence z reálného vzorku inzerátů</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: main result card */}
      <div className="flex items-start justify-end">
        <GlassCard className="w-full max-w-[520px] min-h-[240px] p-8 shadow-[0_24px_52px_rgba(15,23,42,0.16)] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                Výsledek analýzy
              </p>
              <p className="text-sm font-medium text-white">
                {context.title}
              </p>
            </div>
            <StatPill
              label="Konfidence"
              value={`${Math.round(mockConfidence * 100)} %`}
              tone="info"
            />
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
                Férová cena
              </p>
              <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">
                {formatCurrencyCZK(mockFairPrice)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">
                  Férové rozpětí
                </p>
                <p className="text-sm font-medium text-white">
                  {formatCurrencyCZK(mockRange[0])} — {formatCurrencyCZK(mockRange[1])}
                </p>
                <p className="text-[11px] text-white/70">
                  Většina inzerátů spadá do tohoto pásma.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">
                  Deal score (mock)
                </p>
                <p className="text-sm font-semibold text-emerald-300">8.7 / 10</p>
                <p className="text-[11px] text-white/70">
                  Cena je pravděpodobně pod férovým mediánem.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-white/70">
              {mockSampleSize.toLocaleString("cs-CZ")} inzerátů v segmentu. V reálné verzi
              se zde propojí výsledek z cenového indexu a krátký market insight pro
              aktuální konfiguraci auta.
            </p>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

