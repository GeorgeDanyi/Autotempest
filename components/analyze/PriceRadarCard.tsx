"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrencyCZK } from "@/lib/ui";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING, CARD_LABEL } from "@/components/analyze/cardStyles";
import type { SharedAnalysisResult } from "@/lib/pricing/types";

type PriceRadarCardProps = {
  analysisResult: SharedAnalysisResult | null;
};

function buildHistogramBuckets(
  min: number,
  p25: number,
  median: number,
  p75: number,
  max: number,
  bucketCount = 12,
): { price: number; height: number; zone: "low" | "fair" | "high" }[] {
  const range = max - min;
  if (range <= 0) return [];
  return Array.from({ length: bucketCount }, (_, i) => {
    const price = min + (range * i) / (bucketCount - 1);
    const sigma = (p75 - p25) / 1.35;
    const height =
      sigma > 0
        ? Math.exp(-0.5 * Math.pow((price - median) / sigma, 2))
        : price === median
          ? 1
          : 0;
    const zone: "low" | "fair" | "high" =
      price < p25 ? "low" : price <= p75 ? "fair" : "high";
    return { price, height, zone };
  });
}

export function PriceRadarCard({ analysisResult }: PriceRadarCardProps) {
  const { hasData, medianPrice, p25, p75, min, max } = useMemo(() => {
    const median = analysisResult?.median_price_czk ?? null;
    const p25 = analysisResult?.p25_price_czk ?? null;
    const p75 = analysisResult?.p75_price_czk ?? null;
    const min = analysisResult?.min_price_czk ?? null;
    const max = analysisResult?.max_price_czk ?? null;
    if (
      median == null ||
      p25 == null ||
      p75 == null ||
      min == null ||
      max == null ||
      !Number.isFinite(median) ||
      !Number.isFinite(p25) ||
      !Number.isFinite(p75) ||
      !Number.isFinite(min) ||
      !Number.isFinite(max)
    ) {
      return {
        hasData: false,
        medianPrice: 0,
        p25: 0,
        p75: 0,
        min: 0,
        max: 0,
      };
    }
    return { hasData: true, medianPrice: median, p25, p75, min, max };
  }, [analysisResult]);

  const buckets = useMemo(() => {
    if (!hasData) return [];
    return buildHistogramBuckets(min, p25, medianPrice, p75, max);
  }, [hasData, min, p25, medianPrice, p75, max]);

  if (!hasData || buckets.length === 0) {
    return (
      <section aria-label="Cenový radar" className={`${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}>
        <p className={CARD_LABEL}>Cenový radar</p>
        <p className="mt-2 text-sm text-slate-500">Vyberte model pro zobrazení.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Cenový radar"
      className={`price-radar-chart ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={CARD_LABEL}>Cenový radar</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Férové pásmo {formatCurrencyCZK(p25)} – {formatCurrencyCZK(p75)}
            </p>
          </div>
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">
            {formatCurrencyCZK(medianPrice)}
          </span>
        </div>

        <div className="mt-1 h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              barCategoryGap="8%"
            >
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { price: number; zone: string };
                  return (
                    <div
                      style={{
                        background: "#1e293b",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 11,
                        color: "white",
                      }}
                    >
                      <p style={{ color: "rgba(255,255,255,0.7)" }}>
                        {d.price.toLocaleString("cs-CZ")} Kč
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                x={buckets.findIndex(
                  (b, idx) =>
                    b.zone === "fair" &&
                    idx > 0 &&
                    buckets[idx - 1]?.zone === "low",
                )}
                stroke="transparent"
              />
              <Bar dataKey="height" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {buckets.map((b, i) => (
                  <Cell
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    fill={
                      b.zone === "low"
                        ? "#34d399"
                        : b.zone === "fair"
                          ? "#0ea5e9"
                          : "#f87171"
                    }
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400/70" />
            Levné
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-sky-400/70" />
            Férové pásmo
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-red-400/70" />
            Vysoké
          </span>
        </div>
      </div>
    </section>
  );
}

