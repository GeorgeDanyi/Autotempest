"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { ANALYZE_CARD, ANALYZE_CARD_PADDING } from "@/components/analyze/cardStyles";
import { formatCurrencyCZK } from "@/lib/ui";
import type { SharedAnalysisResult } from "@/lib/pricing/types";

type ComparisonItem = {
  model_key: string;
  label: string;
  median: number;
  sample: number;
};

type Props = { analysisResult: SharedAnalysisResult | null };

// Top modely pro každou značku — fallback seznam
const BRAND_MODELS: Record<string, string[]> = {
  skoda: ["skoda_octavia", "skoda_fabia", "skoda_superb", "skoda_karoq", "skoda_kodiaq", "skoda_scala"],
  volkswagen: ["volkswagen_golf", "volkswagen_passat", "volkswagen_tiguan", "volkswagen_polo", "volkswagen_t_roc"],
  bmw: ["bmw_3_series", "bmw_5_series", "bmw_x3", "bmw_x5", "bmw_1_series"],
  audi: ["audi_a3", "audi_a4", "audi_a6", "audi_q3", "audi_q5"],
  mercedes: ["mercedes_c_class", "mercedes_e_class", "mercedes_a_class", "mercedes_glc"],
  toyota: ["toyota_corolla", "toyota_yaris", "toyota_rav4", "toyota_camry"],
  ford: ["ford_focus", "ford_fiesta", "ford_mondeo", "ford_kuga"],
  hyundai: ["hyundai_i30", "hyundai_tucson", "hyundai_i20"],
  kia: ["kia_ceed", "kia_sportage", "kia_stonic"],
};

function getBrandFromModelKey(modelKey: string): string {
  return modelKey.split("_")[0] ?? "";
}

function labelFromModelKey(modelKey: string): string {
  const parts = modelKey.split("_");
  return parts
    .slice(1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function ModelComparisonCard({ analysisResult }: Props) {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(false);

  const currentModelKey = analysisResult?.model_key ?? null;
  const currentMedian = analysisResult?.median_price_czk ?? null;
  const yearFrom = (analysisResult as { year_from?: number | null } | null)?.year_from ?? null;
  const yearTo = (analysisResult as { year_to?: number | null } | null)?.year_to ?? null;

  useEffect(() => {
    if (!currentModelKey) {
      setItems([]);
      return;
    }

    const brand = getBrandFromModelKey(currentModelKey);
    const modelsToFetch = (BRAND_MODELS[brand] ?? [])
      .filter((m) => m !== currentModelKey)
      .slice(0, 5);

    if (modelsToFetch.length === 0) {
      setItems([]);
      return;
    }

    setLoading(true);

    Promise.all(
      modelsToFetch.map(async (model_key) => {
        try {
          const params = new URLSearchParams({ model_key });
          if (yearFrom != null) params.set("yearFrom", String(yearFrom));
          if (yearTo != null) params.set("yearTo", String(yearTo));
          const res = await fetch(`/api/price?${params.toString()}`);
          const d = (await res.json()) as {
            ok?: boolean;
            median_price_czk?: number | null;
            sample_size?: number | null;
          };
          if (!d.ok || d.median_price_czk == null) return null;
          return {
            model_key,
            label: labelFromModelKey(model_key),
            median: d.median_price_czk as number,
            sample: d.sample_size ?? 0,
          } satisfies ComparisonItem;
        } catch {
          return null;
        }
      }),
    )
      .then((results) => {
        const valid = results.filter((x): x is ComparisonItem => x != null);
        if (currentMedian != null) {
          valid.push({
            model_key: currentModelKey,
            label: labelFromModelKey(currentModelKey),
            median: currentMedian,
            sample: analysisResult?.sample_size ?? 0,
          });
        }
        valid.sort((a, b) => a.median - b.median);
        setItems(valid);
      })
      .finally(() => setLoading(false));
  }, [analysisResult, currentModelKey, currentMedian, yearFrom, yearTo]);

  if (!currentModelKey) return null;

  return (
    <div className={`model-comparison-chart ${ANALYZE_CARD} ${ANALYZE_CARD_PADDING}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Srovnání modelů
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {yearFrom && yearTo ? `${yearFrom}–${yearTo} · ` : ""}
            Mediány cen stejné značky
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
          Načítám srovnání…
        </div>
      )}

      {!loading && items.length < 2 && (
        <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
          Nedostatek dat pro srovnání modelů.
        </div>
      )}

      {!loading && items.length >= 2 && (
        <>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={items}
                layout="vertical"
                margin={{ top: 0, right: 80, bottom: 0, left: 0 }}
                barCategoryGap="20%"
                style={{ cursor: "default" }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as ComparisonItem;
                    return (
                      <div
                        style={{
                          background: "#1e293b",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontSize: 12,
                          color: "white",
                        }}
                      >
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.label}</p>
                        <p style={{ color: "rgba(255,255,255,0.7)" }}>
                          Medián:{" "}
                          <span style={{ color: "white", fontWeight: 500 }}>
                            {formatCurrencyCZK(d.median)}
                          </span>
                        </p>
                        <p
                          style={{
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 11,
                          }}
                        >
                          {d.sample.toLocaleString("cs-CZ")} inzerátů
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="median"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                  background={{ fill: "transparent" }}
                >
                  <ReferenceLine x={currentMedian ?? 0} stroke="transparent" />
                  {items.map((item, i) => (
                    <Cell
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      fill={item.model_key === currentModelKey ? "#0ea5e9" : "#e2e8f0"}
                      fillOpacity={item.model_key === currentModelKey ? 1 : 0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Modrá = aktuální model · Šedá = ostatní modely stejné značky
          </p>
        </>
      )}
    </div>
  );
}

