"use client";

import { ArrowDownRight, ArrowRight, Search, ChevronDown } from "lucide-react";
import { formatCurrencyCZK } from "@/lib/ui";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import { GradientButton } from "@/components/price-trends/GradientButton";

const MOCK_DEALS = [
  {
    id: 1,
    title: "Octavia Combi 2.0 TDI Style DSG",
    price: 324_000,
    mileage: "138 000 km",
    year: 2019,
    source: "Sauto.cz",
    deltaVsMedian: "-9,7 %",
    tag: "Nejlevnější vůči mediánu",
  },
  {
    id: 2,
    title: "Octavia 2.0 TDI Ambition",
    price: 339_000,
    mileage: "121 000 km",
    year: 2019,
    source: "TipCars",
    deltaVsMedian: "-5,6 %",
    tag: "Pod férovým pásmem",
  },
  {
    id: 3,
    title: "Octavia 2.0 TDI RS",
    price: 399_000,
    mileage: "167 000 km",
    year: 2018,
    source: "Bazoš",
    deltaVsMedian: "+6,3 %",
    tag: "Výbava / výkon",
  },
  {
    id: 4,
    title: "Octavia Combi 2.0 TDI Scout 4x4",
    price: 429_000,
    mileage: "149 000 km",
    year: 2019,
    source: "AutoScout",
    deltaVsMedian: "+13,0 %",
    tag: "Nad férovým pásmem",
  },
] as const;

function badgeTone(delta: string) {
  if (delta.trim().startsWith("-")) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (delta.trim().startsWith("+")) {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
}

export function BestListingsTable() {
  return (
    <section
      aria-labelledby="best-listings-title"
      className={`${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="best-listings-title"
          className="text-base font-semibold tracking-tight text-slate-800"
        >
          Nejlepší nabídky na trhu
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Hledat nabídky..."
              className="w-full rounded-lg border border-slate-200/80 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200 sm:w-48"
              aria-label="Hledat nabídky"
            />
          </div>
          <GradientButton
            type="button"
            variant="ghost"
            rightIcon={<ChevronDown className="h-3.5 w-3.5" />}
            className="!rounded-full border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
          >
            Řadit podle
          </GradientButton>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200/70">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/40">
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Nabídka
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Cena
              </th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 md:table-cell">
                Nájezd
              </th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 sm:table-cell">
                Rok
              </th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 sm:table-cell">
                Zdroj
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Vs medián
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Akce
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {MOCK_DEALS.map((deal) => (
              <tr
                key={deal.id}
                className="border-b border-slate-100/80 transition-colors last:border-b-0 hover:bg-slate-50/60"
              >
                <td className="px-4 py-3.5">
                  <div>
                    <p className="font-medium text-slate-800">{deal.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {deal.source} · {deal.tag}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-800">
                  {formatCurrencyCZK(deal.price)}
                </td>
                <td className="hidden px-4 py-3.5 text-slate-600 md:table-cell">
                  {deal.mileage}
                </td>
                <td className="hidden px-4 py-3.5 text-slate-600 sm:table-cell">
                  {deal.year}
                </td>
                <td className="hidden px-4 py-3.5 text-slate-600 sm:table-cell">
                  {deal.source}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badgeTone(deal.deltaVsMedian)}`}
                  >
                    <ArrowDownRight className="h-3 w-3" />
                    {deal.deltaVsMedian}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <GradientButton
                    type="button"
                    variant="primary"
                    rightIcon={<ArrowRight className="h-3 w-3" />}
                    className="!rounded-full px-3 py-1.5 text-xs"
                  >
                    Zobrazit
                  </GradientButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
