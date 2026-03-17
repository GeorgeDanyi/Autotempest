"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart";
import type { SharedAnalysisResult } from "@/lib/pricing/types";
import { formatCurrencyCZK } from "@/lib/ui";

type MileagePoint = {
  mileage: number;
  price: number;
  year: number | null;
};

const GRID_STROKE = "rgba(148,163,184,0.15)";
const MIN_POINTS_TO_SHOW = 3;

const MILEAGE_BANDS = [
  { label: "0–50k", min: 0, max: 50_000 },
  { label: "50–100k", min: 50_000, max: 100_000 },
  { label: "100–150k", min: 100_000, max: 150_000 },
  { label: "150–200k", min: 150_000, max: 200_000 },
  { label: "200k+", min: 200_000, max: Number.POSITIVE_INFINITY },
];

type MileageScatterCardProps = {
  analysisResult: SharedAnalysisResult | null;
};

export function MileageScatterCard({ analysisResult }: MileageScatterCardProps) {
  const median = analysisResult?.median_price_czk ?? null;
  const [points, setPoints] = useState<MileagePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const modelKey = analysisResult?.model_key ?? null;
  const resolvedBucket = analysisResult?.resolved_bucket ?? null;
  const mileageFrom = analysisResult?.requested_mileage_from ?? analysisResult?.applied_mileage_from;
  const mileageTo = analysisResult?.requested_mileage_to ?? analysisResult?.applied_mileage_to;
  const resultWithYear = analysisResult as { year_from?: number; yearFrom?: number; year_to?: number; yearTo?: number } | null;
  const yearFrom = resultWithYear?.year_from ?? resultWithYear?.yearFrom ?? searchParams.get("yearFrom");
  const yearTo = resultWithYear?.year_to ?? resultWithYear?.yearTo ?? searchParams.get("yearTo");

  useEffect(() => {
    if (!modelKey) {
      setPoints([]);
      setError(null);
      return;
    }
    const params = new URLSearchParams();
    params.set("model_key", modelKey);
    if (resolvedBucket) params.set("resolved_bucket", resolvedBucket);
    if (mileageFrom != null) params.set("mileageFrom", String(mileageFrom));
    if (mileageTo != null) params.set("mileageTo", String(mileageTo));
    if (yearFrom) params.set("yearFrom", String(yearFrom));
    if (yearTo) params.set("yearTo", String(yearTo));
    setLoading(true);
    setError(null);
    console.log("[scatter] params:", params.toString());
    fetch(`/api/mileage-scatter?${params.toString()}`)
      .then((res) => res.json())
      .then(
        (json: {
          ok?: boolean;
          error?: string;
          points?: Array<{ mileage_km: number; price_czk: number; year: number | null }>;
        }) => {
          console.log("[scatter] response points:", json?.points?.length);
          if (!json.ok) {
            setError(json.error ?? "Chyba");
            setPoints([]);
            return;
          }
          const raw = json.points ?? [];
          const mapped = raw.map((p) => ({
            mileage: p.mileage_km,
            price: p.price_czk,
            year: p.year ?? null,
          }));
          setPoints(mapped);
          setError(null);
        },
      )
      .catch((e) => {
        setError((e as Error).message);
        setPoints([]);
      })
      .finally(() => setLoading(false));
  }, [modelKey, resolvedBucket, mileageFrom, mileageTo, yearFrom, yearTo]);

  const bandData = useMemo(() => {
    return MILEAGE_BANDS.map((band) => {
      const inBand = points.filter((p) => p.mileage >= band.min && p.mileage < band.max);
      if (inBand.length === 0) return null;
      const sorted = inBand
        .map((p) => p.price)
        .filter((n): n is number => n != null && Number.isFinite(n))
        .sort((a, b) => a - b);
      if (sorted.length === 0) return null;
      const medianPrice = sorted[Math.floor(sorted.length / 2)]!;
      return { label: band.label, median: medianPrice, count: inBand.length };
    }).filter(Boolean) as { label: string; median: number; count: number }[];
  }, [points]);

  const showChart = points.length >= MIN_POINTS_TO_SHOW && bandData.length >= 1;
  const showNoData =
    !loading && !error && modelKey != null && (points.length < MIN_POINTS_TO_SHOW || bandData.length === 0);

  return (
    <div
      className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      aria-label="Cena dle nájezdu"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-slate-800">
          Cena dle nájezdu
        </h3>
        <p className="text-[11px] text-slate-500">
          {`Jak klesá cena s nájezdem · ${points.length} vozidel`}
        </p>
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
              Nedostatek dat pro vztah nájezdu a ceny.
            </div>
          )}
          {!loading && !error && showChart && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={bandData}
                margin={{ top: 16, right: 24, bottom: 4, left: 4 }}
              >
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(148,163,184,0.15)"
                  strokeDasharray="3 6"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                {median != null && (
                  <ReferenceLine
                    y={median}
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                    label={{
                      value: `Medián ${Math.round(median / 1000)}k`,
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "#94a3b8",
                    }}
                  />
                )}
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as {
                      label: string;
                      median: number;
                      count: number;
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
                          Nájezd {d.label} km
                        </p>
                        <p style={{ color: "rgba(255,255,255,0.7)" }}>
                          Medián:{" "}
                          <span style={{ color: "white", fontWeight: 500 }}>
                            {d.median.toLocaleString("cs-CZ")} Kč
                          </span>
                        </p>
                        <p style={{ color: "rgba(255,255,255,0.7)" }}>
                          Vozidel:{" "}
                          <span style={{ color: "white", fontWeight: 500 }}>
                            {d.count}
                          </span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="median"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  fill="url(#priceGradient)"
                  dot={{
                    r: 4,
                    fill: "#0ea5e9",
                    strokeWidth: 2,
                    stroke: "white",
                  }}
                  activeDot={{
                    r: 6,
                    fill: "#0ea5e9",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SafeResponsiveChart>
      </div>

      {showChart && (
        <div className="mt-2 flex items-center gap-5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded bg-sky-400" />
            Medián ceny v pásmu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-slate-400/60" />
            Celkový medián
          </span>
        </div>
      )}
    </div>
  );
}

