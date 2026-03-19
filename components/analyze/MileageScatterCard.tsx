"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import type { SharedAnalysisResult } from "@/lib/pricing/types";
import { formatCurrencyCZK } from "@/lib/ui";

type MileagePoint = {
  mileage: number;
  price: number;
  year: number | null;
};

const GRID_STROKE = "rgba(148,163,184,0.15)";
const MIN_POINTS_TO_SHOW = 3;

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
    const hasExplicitFilters =
      yearFrom != null || yearTo != null || mileageFrom != null || mileageTo != null;
    if (resolvedBucket && resolvedBucket !== "all" && hasExplicitFilters) {
      params.set("resolved_bucket", resolvedBucket);
    }
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

  const hasSegment =
    mileageFrom != null ||
    mileageTo != null ||
    yearFrom != null ||
    yearTo != null;

  const chartData = useMemo(() => {
    const yearFromNumber = yearFrom == null ? null : Number(yearFrom);
    const yearToNumber = yearTo == null ? null : Number(yearTo);
    return points.map((p) => {
      const inMileageRange =
        (mileageFrom == null || p.mileage >= mileageFrom) &&
        (mileageTo == null || p.mileage <= mileageTo);
      const inYearRange =
        (yearFromNumber == null || (p.year != null && p.year >= yearFromNumber)) &&
        (yearToNumber == null || (p.year != null && p.year <= yearToNumber));
      return {
        mileage: p.mileage,
        price: p.price,
        year: p.year,
        inSegment: hasSegment ? inMileageRange && inYearRange : true,
      };
    });
  }, [points, hasSegment, mileageFrom, mileageTo, yearFrom, yearTo]);

  const regression = useMemo(() => {
    if (chartData.length < 2) return null;
    const n = chartData.length;
    const sumX = chartData.reduce((acc, p) => acc + p.mileage, 0);
    const sumY = chartData.reduce((acc, p) => acc + p.price, 0);
    const sumXY = chartData.reduce((acc, p) => acc + p.mileage * p.price, 0);
    const sumXX = chartData.reduce((acc, p) => acc + p.mileage * p.mileage, 0);
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    const minMileage = Math.min(...chartData.map((p) => p.mileage));
    const maxMileage = Math.max(...chartData.map((p) => p.mileage));
    return {
      slope,
      intercept,
      start: { x: minMileage, y: slope * minMileage + intercept },
      end: { x: maxMileage, y: slope * maxMileage + intercept },
    };
  }, [chartData]);

  const underTrendCount = useMemo(() => {
    if (!regression) return 0;
    return chartData.filter(
      (p) => p.inSegment && p.price < regression.slope * p.mileage + regression.intercept,
    ).length;
  }, [chartData, regression]);

  const showChart = chartData.length >= MIN_POINTS_TO_SHOW;
  const showNoData =
    !loading && !error && modelKey != null && chartData.length < MIN_POINTS_TO_SHOW;

  const SVG_W = 600;
  const SVG_H = 220;
  const PAD = { top: 16, right: 24, bottom: 32, left: 52 };
  const plotW = SVG_W - PAD.left - PAD.right;
  const plotH = SVG_H - PAD.top - PAD.bottom;

  const minX = showChart ? Math.min(...chartData.map((p) => p.mileage)) : 0;
  const maxX = showChart ? Math.max(...chartData.map((p) => p.mileage)) : 1;
  const minY = showChart ? Math.min(...chartData.map((p) => p.price)) : 0;
  const maxY = showChart ? Math.max(...chartData.map((p) => p.price)) : 1;

  const toSvgX = (v: number) =>
    PAD.left + ((v - minX) / (maxX - minX || 1)) * plotW;
  const toSvgY = (v: number) =>
    PAD.top + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  return (
    <div
      className={`flex flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      style={{ minHeight: 320 }}
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

      <div
        style={{ width: "100%", height: SVG_H, marginTop: "1.5rem", minWidth: 0, display: "block" }}
      >
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
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width: "100%", height: SVG_H }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <line
                // eslint-disable-next-line react/no-array-index-key
                key={t}
                x1={PAD.left}
                x2={SVG_W - PAD.right}
                y1={PAD.top + t * plotH}
                y2={PAD.top + t * plotH}
                stroke="#e2e8f0"
                strokeDasharray="3 6"
              />
            ))}
            {regression && (
              <line
                x1={toSvgX(regression.start.x)}
                y1={toSvgY(regression.start.y)}
                x2={toSvgX(regression.end.x)}
                y2={toSvgY(regression.end.y)}
                stroke="#185FA5"
                strokeWidth={2}
                strokeOpacity={0.6}
              />
            )}
            {chartData.map((p, i) => (
              <circle
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                cx={toSvgX(p.mileage)}
                cy={toSvgY(p.price)}
                r={4}
                fill={p.inSegment !== false ? "#185FA5" : "#B5D4F4"}
                fillOpacity={0.7}
              />
            ))}
            {[minX, (minX + maxX) / 2, maxX].map((v, i) => (
              <text
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                x={toSvgX(v)}
                y={SVG_H - 6}
                textAnchor="middle"
                fontSize={11}
                fill="#94a3b8"
              >
                {Math.round(v / 1000)}k
              </text>
            ))}
            {[minY, (minY + maxY) / 2, maxY].map((v, i) => (
              <text
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                x={PAD.left - 6}
                y={toSvgY(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill="#94a3b8"
              >
                {Math.round(v / 1000)}k
              </text>
            ))}
          </svg>
        )}
      </div>

      {showChart && (
        <p className="mt-2 text-[11px] text-slate-500">
          {underTrendCount > 0
            ? `${underTrendCount} aut v segmentu je pod ideální křivkou — potenciálně podhodnocená.`
            : `Zobrazeno ${chartData.length} aut. Křivka ukazuje ideální poměr ceny a nájezdu.`}
        </p>
      )}
    </div>
  );
}

