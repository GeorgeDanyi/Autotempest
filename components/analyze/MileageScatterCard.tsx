"use client";

import { useEffect, useState } from "react";
import {
  Scatter,
  ScatterChart,
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

/** Chart point (mileage/price/year for axes and tooltip). */
type MileagePoint = {
  mileage: number;
  price: number;
  year: number | null;
};

const GRID_STROKE = "rgba(148,163,184,0.2)";
const MIN_POINTS_TO_SHOW = 3;

type MileageScatterCardProps = {
  analysisResult: SharedAnalysisResult | null;
};

export function MileageScatterCard({ analysisResult }: MileageScatterCardProps) {
  const median = analysisResult?.median_price_czk ?? null;
  const [points, setPoints] = useState<MileagePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelKey = analysisResult?.model_key ?? null;
  const resolvedBucket = analysisResult?.resolved_bucket ?? null;
  const mileageFrom = analysisResult?.requested_mileage_from ?? analysisResult?.applied_mileage_from;
  const mileageTo = analysisResult?.requested_mileage_to ?? analysisResult?.applied_mileage_to;

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
    setLoading(true);
    setError(null);
    fetch(`/api/mileage-scatter?${params.toString()}`)
      .then((res) => res.json())
      .then((json: { ok?: boolean; error?: string; points?: Array<{ mileage_km: number; price_czk: number; year: number | null }> }) => {
        if (!json.ok) {
          setError(json.error ?? "Chyba");
          setPoints([]);
          return;
        }
        const raw = json.points ?? [];
        setPoints(
          raw.map((p) => ({
            mileage: p.mileage_km,
            price: p.price_czk,
            year: p.year ?? null,
          })),
        );
        setError(null);
      })
      .catch((e) => {
        setError((e as Error).message);
        setPoints([]);
      })
      .finally(() => setLoading(false));
  }, [modelKey, resolvedBucket, mileageFrom, mileageTo]);

  const showChart = points.length >= MIN_POINTS_TO_SHOW;
  const showNoData = !loading && !error && modelKey != null && points.length < MIN_POINTS_TO_SHOW;

  return (
    <div
      className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      aria-label="Nájezd vs cena"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-slate-800">
          Nájezd vs. cena
        </h3>
        <p className="text-[11px] text-slate-500">
          {median != null ? `Segment medián ${formatCurrencyCZK(median)} · hodnota dle nájezdu` : "Hodnota dle nájezdu"}
        </p>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50/70 p-5">
        <SafeResponsiveChart className="h-[200px] w-full min-h-[200px]">
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
              <ScatterChart margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid
                  stroke={GRID_STROKE}
                  strokeDasharray="3 6"
                  vertical={false}
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="mileage"
                  tick={{ fontSize: 12, fontWeight: 500, fill: "#475569" }}
                  name="Nájezd"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(value: number) =>
                    `${Math.round(value / 1000)}k km`
                  }
                />
                <YAxis
                  dataKey="price"
                  tick={{
                    fontSize: 12,
                    fontWeight: 500,
                    fill: "#64748b",
                  }}
                  name="Cena"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
                  width={48}
                />
                <Tooltip
                  wrapperStyle={{ outline: "none" }}
                  contentStyle={{
                    backgroundColor: "white",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    padding: "8px 12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                  cursor={{
                    stroke: "rgba(148,163,184,0.4)",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as MileagePoint;
                    return (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-800">
                          Rok {point.year != null ? point.year : "–"}
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Cena:</span>{" "}
                          {point.price.toLocaleString("cs-CZ")} Kč
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Nájezd:</span>{" "}
                          {point.mileage.toLocaleString("cs-CZ")} km
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={points}
                  fill="#0ea5e9"
                  fillOpacity={0.75}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </SafeResponsiveChart>
      </div>
    </div>
  );
}
