"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart";
import type { SharedAnalysisResult } from "@/lib/pricing/types";
import { formatCurrencyCZK } from "@/lib/ui";

type YearPricePoint = {
  year: number;
  median_price_czk: number;
  sample_size: number;
};

type YearPriceCardProps = {
  analysisResult: {
    model_key: string;
    year_from?: number;
    year_to?: number;
    fuel?: string | null;
    engine_key?: string | null;
  } | null;
  selectedYear?: number | null;
};

const MIN_POINTS = 3;

export function YearPriceCard({ analysisResult, selectedYear }: YearPriceCardProps) {
  const searchParams = useSearchParams();
  const modelKey = analysisResult?.model_key ?? null;

  const fuelFromAnalysis =
    (analysisResult as { fuel?: string | null } | null)?.fuel ??
    searchParams.get("fuel")?.trim() ??
    null;
  const engineFromAnalysis =
    (analysisResult as { engine_key?: string | null } | null)?.engine_key ??
    searchParams.get("engine")?.trim() ??
    null;

  const [points, setPoints] = useState<YearPricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelKey) {
      setPoints([]);
      setError(null);
      return;
    }

    const params = new URLSearchParams();
    params.set("model_key", modelKey);
    if (fuelFromAnalysis) params.set("fuel", fuelFromAnalysis);
    if (engineFromAnalysis) params.set("engine", engineFromAnalysis);

    setLoading(true);
    setError(null);

    fetch(`/api/year-price?${params.toString()}`)
      .then((res) => res.json())
      .then(
        (json: {
          ok?: boolean;
          error?: string;
          data?: Array<{ year: number; median_price_czk: number; sample_size: number }>;
        }) => {
          if (!json.ok) {
            setError(json.error ?? "Chyba");
            setPoints([]);
            return;
          }
          const data = json.data ?? [];
          setPoints(
            data.map((d) => ({
              year: d.year,
              median_price_czk: d.median_price_czk,
              sample_size: d.sample_size,
            })),
          );
          setError(null);
        },
      )
      .catch((e) => {
        setError((e as Error).message);
        setPoints([]);
      })
      .finally(() => setLoading(false));
  }, [modelKey, fuelFromAnalysis, engineFromAnalysis]);

  const hasEnoughData = points.length >= MIN_POINTS;

  const medianOfYears = useMemo(() => {
    if (!hasEnoughData) return null;
    const sorted = points
      .map((p) => p.median_price_czk)
      .filter((n) => n != null && Number.isFinite(n))
      .sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
      : sorted[mid]!;
  }, [points, hasEnoughData]);

  const insight = useMemo(() => {
    if (!hasEnoughData) {
      return "Nedostatek dat pro tento segment.";
    }
    if (!selectedYear) {
      return "Zobrazeny všechny ročníky modelu v databázi.";
    }
    const selectedPoint = points.find((p) => p.year === selectedYear) ?? null;
    if (!selectedPoint || !medianOfYears) {
      return "Zobrazeny všechny ročníky modelu v databázi.";
    }
    if (selectedPoint.median_price_czk <= medianOfYears) {
      return `Ročník ${selectedYear} patří k cenově dostupnějším — dobrý poměr ceny a stáří.`;
    }
    return `Ročník ${selectedYear} je v prémiové části generace.`;
  }, [hasEnoughData, points, selectedYear, medianOfYears]);

  const dataForChart = useMemo(() => {
    if (!hasEnoughData) return [];
    const maxPrice = Math.max(
      ...points.map((p) => p.median_price_czk).filter((n) => n != null && Number.isFinite(n)),
    );
    return points.map((p) => {
      const distance =
        selectedYear != null ? Math.abs(p.year - selectedYear) : 0;
      const normalizedDistance =
        selectedYear != null && maxPrice > 0 ? Math.min(distance / 8, 1) : 0;
      const baseColor = 0x18_5f_a5;
      const baseR = (baseColor >> 16) & 0xff;
      const baseG = (baseColor >> 8) & 0xff;
      const baseB = baseColor & 0xff;
      const factor = 0.35 + (1 - normalizedDistance) * 0.65;
      const r = Math.round(baseR * factor);
      const g = Math.round(baseG * factor);
      const b = Math.round(baseB * factor);
      const fill = `rgb(${r}, ${g}, ${b})`;

      const isSelected = selectedYear != null && p.year === selectedYear;

      return {
        ...p,
        fill,
        isSelected,
      };
    });
  }, [points, hasEnoughData, selectedYear]);

  const showNoData =
    !loading && !error && modelKey != null && !hasEnoughData;

  return (
    <div
      className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      aria-label="Cena dle roku výroby"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-slate-800">
            Cena dle roku výroby
          </h3>
          <p className="text-[11px] text-slate-500">
            Jak se vyvíjí medián ceny v jednotlivých ročnících.
          </p>
        </div>
        {selectedYear != null && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">
            Váš rok: {selectedYear}
          </span>
        )}
      </div>

      <div className="mt-6">
        <SafeResponsiveChart className="h-[220px] w-full min-h-[220px]">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Načítám…
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Chyba načtení dat.
            </div>
          )}
          {!loading && !error && showNoData && (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Nedostatek dat pro tento segment.
            </div>
          )}
          {!loading && !error && hasEnoughData && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataForChart}
                margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  stroke="rgba(148,163,184,0.15)"
                  strokeDasharray="3 6"
                  vertical={false}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]
                      ?.payload as YearPricePoint & {
                      isSelected?: boolean;
                    };
                    return (
                      <div
                        style={{
                          background: "#1e293b",
                          borderRadius: 10,
                          padding: "10px 14px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                          fontSize: 12,
                        }}
                      >
                        <p
                          style={{
                            color: "rgba(255,255,255,0.9)",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          Rok {d.year}
                        </p>
                        <p style={{ color: "rgba(255,255,255,0.7)" }}>
                          Medián:{" "}
                          <span style={{ color: "white", fontWeight: 500 }}>
                            {formatCurrencyCZK(d.median_price_czk)}
                          </span>
                        </p>
                        <p style={{ color: "rgba(255,255,255,0.7)" }}>
                          Inzerátů:{" "}
                          <span style={{ color: "white", fontWeight: 500 }}>
                            {d.sample_size}
                          </span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="median_price_czk"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={500}
                  animationEasing="ease-out"
                >
                  {dataForChart.map((entry, index) => (
                    <rect
                      key={entry.year}
                      x={0}
                      y={0}
                      width={0}
                      height={0}
                    />
                  ))}
                  {/*
                    Používáme funkci fill dle payloadu přes props v data,
                    Recharts použije `fill` přímo z dat pro jednotlivé bary.
                  */}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SafeResponsiveChart>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">{insight}</p>
    </div>
  );
}
