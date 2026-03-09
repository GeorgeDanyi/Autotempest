"use client";

import { Badge } from "@/components/ui/badge";

type MarketInsightsProps = {
  modelLabel: string | null;
};

export function MarketInsights({ modelLabel }: MarketInsightsProps) {
  return (
    <div className="group col-span-1 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:border-blue-400/60 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Market insights
          </p>
          <p className="text-xs text-slate-500">
            Rychlý snapshot trhu pro zvolený model.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-[11px]">
          Live beta
        </Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
        <div className="space-y-0.5">
          <dt className="text-[11px] text-slate-500">Median price</dt>
          <dd className="text-sm font-semibold text-slate-900">359 000 Kč</dd>
          <p className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <span className="text-[11px]">▲</span> +1.2 % m/m
          </p>
        </div>
        <div className="space-y-0.5">
          <dt className="text-[11px] text-slate-500">Median mileage</dt>
          <dd className="text-sm font-semibold text-slate-900">142 000 km</dd>
          <p className="text-[11px] text-slate-500">
            Typicky 7–11 let stáří vozů v inzerci.
          </p>
        </div>
        <div className="space-y-0.5">
          <dt className="text-[11px] text-slate-500">Time to sell</dt>
          <dd className="text-sm font-semibold text-slate-900">23 dní</dd>
          <p className="text-[11px] text-slate-500">
            Průměrná doba aktivního inzerátu pro férově naceněné vozy.
          </p>
        </div>
        <div className="space-y-0.5">
          <dt className="text-[11px] text-slate-500">Price stability</dt>
          <dd className="text-sm font-semibold text-slate-900">Nízká volatilita</dd>
          <p className="text-[11px] text-slate-500">
            Trh je relativně stabilní, bez prudkých výkyvů.
          </p>
        </div>
      </dl>

      <p className="mt-4 rounded-xl bg-slate-50/80 p-3 text-[11px] text-slate-600">
        {modelLabel ? (
          <>
            Data vychází z agregovaných inzerátů modelu{" "}
            <span className="font-semibold">{modelLabel}</span> na českém trhu.
          </>
        ) : (
          <>
            Jakmile nahoře vybereš konkrétní model, uvidíš zde kontextové metriky
            pro jeho reálné tržní chování.
          </>
        )}
      </p>
    </div>
  );
}

