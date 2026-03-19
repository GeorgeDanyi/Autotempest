"use client";

import { useEffect, useMemo, useState } from "react";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING, CARD_LABEL } from "@/components/analyze/cardStyles";
import { formatCurrencyCZK } from "@/lib/ui";

type FuelPriceCardProps = {
  analysisResult: { model_key: string; year_from?: number; year_to?: number } | null;
};

type FuelKey = "benzin" | "diesel" | "hybrid" | "elektro";

type FuelRow = {
  key: FuelKey;
  label: string;
  color: string;
  queryValue: string;
};

type YearPriceResponse = {
  ok?: boolean;
  error?: string;
  data?: Array<{ year: number; median_price_czk: number; sample_size: number }>;
};

const FUEL_ROWS: FuelRow[] = [
  { key: "benzin", label: "Benzín", color: "#85B7EB", queryValue: "benzin" },
  { key: "diesel", label: "Diesel", color: "#185FA5", queryValue: "diesel" },
  { key: "hybrid", label: "Hybrid", color: "#5DCAA5", queryValue: "hybrid" },
  { key: "elektro", label: "Elektro", color: "#9FE1CB", queryValue: "elektro" },
];

export function FuelPriceCard({ analysisResult }: FuelPriceCardProps) {
  const [valuesByFuel, setValuesByFuel] = useState<Record<FuelKey, number | null>>({
    benzin: null,
    diesel: null,
    hybrid: null,
    elektro: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelKey = analysisResult?.model_key ?? null;
  const currentFuelRaw = (analysisResult as { fuel?: string | null } | null)?.fuel ?? null;
  const currentFuel = currentFuelRaw?.toLowerCase() ?? "";
  const highlightedFuel = useMemo<FuelKey | null>(() => {
    if (!currentFuel) return null;
    if (currentFuel.includes("ben")) return "benzin";
    if (currentFuel.includes("naf") || currentFuel.includes("dies")) return "diesel";
    if (currentFuel.includes("hyb")) return "hybrid";
    if (currentFuel.includes("ele")) return "elektro";
    return null;
  }, [currentFuel]);

  useEffect(() => {
    if (!modelKey) {
      setValuesByFuel({ benzin: null, diesel: null, hybrid: null, elektro: null });
      setError(null);
      return;
    }

    const yearFrom = analysisResult?.year_from;
    const yearTo = analysisResult?.year_to;
    setLoading(true);
    setError(null);

    Promise.all(
      FUEL_ROWS.map(async (fuel) => {
        const params = new URLSearchParams();
        params.set("model_key", modelKey);
        params.set("fuel", fuel.queryValue);
        if (yearFrom != null) params.set("yearFrom", String(yearFrom));
        if (yearTo != null) params.set("yearTo", String(yearTo));
        const res = await fetch(`/api/year-price?${params.toString()}`);
        const json = (await res.json()) as YearPriceResponse;
        if (!json.ok) {
          return { key: fuel.key, value: null as number | null, error: json.error ?? "Chyba" };
        }
        const medians = (json.data ?? [])
          .map((d) => d.median_price_czk)
          .filter((n): n is number => Number.isFinite(n));
        if (medians.length === 0) {
          return { key: fuel.key, value: null as number | null, error: null };
        }
        const avgMedian = Math.round(
          medians.reduce((acc, n) => acc + n, 0) / medians.length,
        );
        return { key: fuel.key, value: avgMedian, error: null };
      }),
    )
      .then((results) => {
        const next: Record<FuelKey, number | null> = {
          benzin: null,
          diesel: null,
          hybrid: null,
          elektro: null,
        };
        let firstError: string | null = null;
        for (const item of results) {
          next[item.key] = item.value;
          if (!firstError && item.error) firstError = item.error;
        }
        setValuesByFuel(next);
        setError(firstError);
      })
      .catch((e) => {
        setValuesByFuel({ benzin: null, diesel: null, hybrid: null, elektro: null });
        setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, [modelKey, analysisResult?.year_from, analysisResult?.year_to]);

  const rows = useMemo(() => {
    const max = Math.max(
      0,
      ...FUEL_ROWS.map((fuel) => valuesByFuel[fuel.key] ?? 0),
    );
    return FUEL_ROWS.map((fuel) => {
      const value = valuesByFuel[fuel.key];
      const widthPct = value != null && max > 0 ? (value / max) * 100 : 0;
      return {
        ...fuel,
        value,
        widthPct,
        isHighlighted: highlightedFuel === fuel.key,
      };
    });
  }, [valuesByFuel, highlightedFuel]);

  const fuelsWithData = rows.filter((row) => row.value != null);
  const hasEnoughData = fuelsWithData.length >= 2;

  const insight = useMemo(() => {
    const diesel = valuesByFuel.diesel;
    const benzin = valuesByFuel.benzin;
    if (diesel == null || benzin == null || benzin <= 0 || diesel <= 0) {
      return "Nedostatek dat pro porovnání.";
    }
    if (diesel >= benzin) {
      const premium = Math.round(((diesel - benzin) / benzin) * 100);
      return `Diesel má v tomto segmentu premium +${premium} % oproti benzínu.`;
    }
    const premium = Math.round(((benzin - diesel) / diesel) * 100);
    return `Benzín má v tomto segmentu premium +${premium} % oproti dieselu.`;
  }, [valuesByFuel]);

  return (
    <div className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}>
      <div className="space-y-1">
        <p className={CARD_LABEL}>SROVNÁNÍ PODLE PALIVA</p>
        <h3 className="text-sm font-semibold tracking-tight text-slate-800">
          Medián ceny stejného modelu a roku dle typu pohonu
        </h3>
      </div>

      <div className="mt-5 space-y-3">
        {loading && (
          <>
            {FUEL_ROWS.map((row) => (
              <div key={row.key} className="grid grid-cols-[72px_1fr_auto] items-center gap-3">
                <div className="h-3 w-14 animate-pulse rounded bg-slate-200" />
                <div className="h-3.5 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </>
        )}

        {!loading && hasEnoughData && (
          <>
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-[72px_1fr_auto] items-center gap-3">
                <span
                  className={`text-xs ${
                    row.isHighlighted ? "font-semibold text-slate-800" : "font-medium text-slate-600"
                  }`}
                >
                  {row.label}
                </span>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${row.widthPct}%`,
                      backgroundColor: row.isHighlighted ? "#0F4C8A" : row.color,
                    }}
                  />
                </div>
                <span
                  className={`text-xs tabular-nums ${
                    row.isHighlighted ? "font-semibold text-slate-800" : "text-slate-600"
                  }`}
                >
                  {row.value != null ? formatCurrencyCZK(row.value) : "—"}
                </span>
              </div>
            ))}
          </>
        )}

        {!loading && !hasEnoughData && (
          <div className="py-4 text-sm text-slate-500">Nedostatek dat pro srovnání.</div>
        )}
      </div>

      {!loading && !error && hasEnoughData && (
        <p className="mt-4 text-[11px] text-slate-500">{insight}</p>
      )}
      {!loading && error && hasEnoughData && (
        <p className="mt-4 text-[11px] text-slate-500">{insight}</p>
      )}
    </div>
  );
}
