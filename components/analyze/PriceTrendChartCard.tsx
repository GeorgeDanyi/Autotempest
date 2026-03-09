"use client";

import { useEffect, useMemo, useState } from "react";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING, CARD_LABEL, CARD_TITLE } from "@/components/analyze/cardStyles";
import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart";
import type { SharedAnalysisResult } from "@/lib/pricing/types";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MONTH_LABELS: Record<string, string> = {
  "01": "led", "02": "úno", "03": "bře", "04": "dub", "05": "kvě", "06": "čvn",
  "07": "čvc", "08": "srp", "09": "zář", "10": "říj", "11": "lis", "12": "pro",
};

function formatMonthKey(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length >= 2) {
    const month = MONTH_LABELS[parts[1]] ?? parts[1];
    const year = parts[0].slice(2);
    return `${month} ${year}`;
  }
  return dateKey;
}

type WindowOption = "3m" | "6m" | "12m";

type PriceTrendChartCardProps = {
  analysisResult: SharedAnalysisResult | null;
};

type TrendPoint = { date: string; median_price_czk: number };

export function PriceTrendChartCard({ analysisResult }: PriceTrendChartCardProps) {
  const [windowSize, setWindowSize] = useState<WindowOption>("6m");
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelKey = analysisResult?.model_key ?? null;
  const resolvedBucket = analysisResult?.resolved_bucket ?? null;

  useEffect(() => {
    if (!modelKey || !resolvedBucket) {
      setPoints([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      `/api/pricetrend?model_key=${encodeURIComponent(modelKey)}&resolved_bucket=${encodeURIComponent(resolvedBucket)}&range=${windowSize}`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then((json: { ok?: boolean; error?: string; points?: TrendPoint[] }) => {
        if (!json.ok || !Array.isArray(json.points)) {
          setPoints([]);
          setError(json.error ?? "Chyba");
          return;
        }
        setPoints(json.points);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setPoints([]);
          setError((e as Error).message);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [modelKey, resolvedBucket, windowSize]);

  const chartData = useMemo(() => {
    return points.map((p) => ({
      month: formatMonthKey(p.date),
      price: p.median_price_czk,
    }));
  }, [points]);

  const hasEnoughData = chartData.length >= 3;

  return (
    <div
      className={`${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      aria-label="Vývoj ceny"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className={CARD_LABEL}>Vývoj cen</p>
          <h3 className={CARD_TITLE}>Medián ceny za období</h3>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setWindowSize("3m")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              windowSize === "3m" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            3M
          </button>
          <button
            type="button"
            onClick={() => setWindowSize("6m")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              windowSize === "6m" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            6M
          </button>
          <button
            type="button"
            onClick={() => setWindowSize("12m")}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              windowSize === "12m" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            12M
          </button>
        </div>
      </div>

      <SafeResponsiveChart className="mt-7 h-[220px] w-full min-h-[220px]">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Načítám trend…
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {error}
          </div>
        )}
        {!loading && !error && !hasEnoughData && (modelKey && resolvedBucket) && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Nedostatek historických dat pro trend.
          </div>
        )}
        {!loading && !error && (!modelKey || !resolvedBucket) && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Vyberte model pro zobrazení trendu.
          </div>
        )}
        {!loading && !error && hasEnoughData && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceTrendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 4" vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 500 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "8px 12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
                labelFormatter={(label) => String(label ?? "")}
                formatter={(value) => [`${Number(value ?? 0).toLocaleString("cs-CZ")} Kč`, "Medián"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                fill="url(#priceTrendArea)"
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: "#fff",
                  fill: "#3b82f6",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SafeResponsiveChart>
    </div>
  );
}
