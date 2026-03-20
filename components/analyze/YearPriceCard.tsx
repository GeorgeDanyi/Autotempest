"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import { formatCurrencyCZK, roundToNearest } from "@/lib/ui";

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
  currentPrice?: number | null;
};

const MIN_POINTS = 3;

export function YearPriceCard({ analysisResult, selectedYear, currentPrice }: YearPriceCardProps) {
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

  const regression = useMemo(() => {
    if (!hasEnoughData) return null;
    const sorted = [...points].sort((a, b) => a.year - b.year);
    if (sorted.length < 2) return null;
    const n = sorted.length;
    const sumX = sorted.reduce((acc, p) => acc + p.year, 0);
    const sumY = sorted.reduce((acc, p) => acc + p.median_price_czk, 0);
    const sumXY = sorted.reduce((acc, p) => acc + p.year * p.median_price_czk, 0);
    const sumXX = sorted.reduce((acc, p) => acc + p.year * p.year, 0);
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const avgPrice = sumY / n;
    return { slope, avgPrice };
  }, [points, hasEnoughData]);

  const annualDeclinePct = useMemo(() => {
    if (!regression || !Number.isFinite(regression.avgPrice) || regression.avgPrice === 0) {
      return null;
    }
    const raw = Math.abs((regression.slope / regression.avgPrice) * 100);
    if (!Number.isFinite(raw)) return null;
    return Math.min(50, Math.round(raw * 10) / 10);
  }, [regression]);

  const projection = useMemo(() => {
    if (!hasEnoughData || currentPrice == null || currentPrice <= 0 || annualDeclinePct == null) {
      return null;
    }
    const prices: number[] = [currentPrice];
    for (let i = 1; i < 4; i += 1) {
      const prev = prices[i - 1]!;
      prices.push(Math.round(prev * (1 - annualDeclinePct / 100)));
    }
    return prices;
  }, [hasEnoughData, currentPrice, annualDeclinePct]);

  const insight = useMemo(() => {
    if (!hasEnoughData || !projection || annualDeclinePct == null) {
      return "Nedostatek dat pro tento segment.";
    }
    const finalPrice = projection[3]!;
    const totalPct = currentPrice && currentPrice > 0
      ? Math.round(((currentPrice - finalPrice) / currentPrice) * 100)
      : null;
    return totalPct != null
      ? `Za 3 roky odhadovaná hodnota: ${formatCurrencyCZK(roundToNearest(finalPrice))} (pokles o ${totalPct} %).`
      : `Za 3 roky odhadovaná hodnota: ${formatCurrencyCZK(roundToNearest(finalPrice))}.`;
  }, [hasEnoughData, projection, annualDeclinePct, currentPrice]);

  const showNoData =
    !loading && !error && modelKey != null && (!hasEnoughData || !projection || annualDeclinePct == null);

  const SVG_W = 600;
  const SVG_H = 220;
  const PAD = { top: 24, right: 32, bottom: 36, left: 48 };
  const plotW = SVG_W - PAD.left - PAD.right;
  const plotH = SVG_H - PAD.top - PAD.bottom;

  const labels = ["Dnes", "+1 rok", "+2 roky", "+3 roky"];

  const priceMin = projection ? Math.min(...projection) : 0;
  const priceMax = projection ? Math.max(...projection) : 1;
  const minY = priceMin > 0 ? priceMin * 0.9 : 0;
  const maxY = priceMax * 1.05;

  const toSvgX = (index: number) =>
    PAD.left + (index / Math.max(1, labels.length - 1)) * plotW;
  const toSvgY = (v: number) =>
    PAD.top + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  return (
    <div
      className={`flex h-full flex-col ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
      aria-label="Ztráta hodnoty v čase"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-slate-800">
            Ztráta hodnoty v čase
          </h3>
          <p className="text-[11px] text-slate-500">
            Odhadovaný vývoj ceny po koupi.
          </p>
        </div>
        {annualDeclinePct != null && (
          <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-medium text-red-600 ring-1 ring-red-100">
            −{annualDeclinePct} % / rok
          </span>
        )}
      </div>

      <div className="mt-5">
        {loading && (
          <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
            Načítám…
          </div>
        )}
        {!loading && error && (
          <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
            Chyba načtení dat.
          </div>
        )}
        {!loading && !error && showNoData && (
          <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
            Nedostatek dat pro predikci.
          </div>
        )}
        {!loading && !error && !showNoData && projection && (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width: "100%", height: SVG_H }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              // eslint-disable-next-line react/no-array-index-key
              <line
                key={t}
                x1={PAD.left}
                x2={SVG_W - PAD.right}
                y1={PAD.top + t * plotH}
                y2={PAD.top + t * plotH}
                stroke="#e2e8f0"
                strokeDasharray="3 6"
              />
            ))}
            <path
              d={projection
                .map((price, index) => {
                  const x = toSvgX(index);
                  const y = toSvgY(price);
                  return `${index === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#185FA5"
              strokeWidth={2.5}
            />
            {projection.map((price, index) => {
              const cx = toSvgX(index);
              const cy = toSvgY(price);
              const isNow = index === 0;
              return (
                // eslint-disable-next-line react/no-array-index-key
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isNow ? 7 : 5}
                  fill={isNow ? "#185FA5" : "#ffffff"}
                  stroke="#185FA5"
                  strokeWidth={2}
                />
              );
            })}
            {projection.map((price, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <text
                key={`label-${index}`}
                x={(index / Math.max(1, labels.length - 1)) * SVG_W}
                y={SVG_H - 10}
                textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
                fontSize={12}
                fill="#64748b"
              >
                {labels[index]}
              </text>
            ))}
            {[minY, (minY + maxY) / 2, maxY].map((v, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <text
                key={`y-${index}`}
                x={PAD.left - 8}
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

      <p className="mt-3 text-[11px] text-slate-500">{insight}</p>
      <p className="mt-1 text-[10px] text-slate-400">
        Odhad na základě historických dat modelu. Skutečný vývoj ceny závisí na stavu vozu a tržních podmínkách.
      </p>
    </div>
  );
}
