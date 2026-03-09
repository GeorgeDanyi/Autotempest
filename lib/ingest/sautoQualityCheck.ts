/**
 * Jednoduchý quality check po SAUTO ingestu – přehled kvality dat v market_observations.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const TOP_ENGINE_KEY_LIMIT = 10;
const ENGINE_KEY_SAMPLE_LIMIT = 15_000;

export type SautoQualitySummary = {
  total: number;
  missing_model_key: number;
  missing_price_czk: number;
  missing_year: number;
  missing_mileage_km: number;
  missing_engine_key: number;
  top_engine_keys: { key: string; count: number }[];
};

/**
 * Spočítá pro source = "sauto": chybějící pole a top engine_key podle počtu.
 */
export async function getSautoQualitySummary(
  supabase: SupabaseClient
): Promise<SautoQualitySummary> {
  const [totalRes, modelKeyNullRes, modelKeyEmptyRes, priceRes, yearRes, mileageRes, engineKeyNullRes, engineKeyEmptyRes, engineKeyRowsRes] =
    await Promise.all([
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto"),
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto")
        .is("model_key", null),
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto")
        .eq("model_key", ""),
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto")
        .is("price_czk", null),
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto")
        .is("year", null),
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto")
        .is("mileage_km", null),
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto")
        .is("engine_key", null),
      supabase
        .from("market_observations")
        .select("*", { count: "exact", head: true })
        .eq("source", "sauto")
        .eq("engine_key", ""),
      supabase
        .from("market_observations")
        .select("engine_key")
        .eq("source", "sauto")
        .limit(ENGINE_KEY_SAMPLE_LIMIT),
    ]);

  const total = totalRes.count ?? 0;
  const missing_model_key = (modelKeyNullRes.count ?? 0) + (modelKeyEmptyRes.count ?? 0);
  const missing_price_czk = priceRes.count ?? 0;
  const missing_year = yearRes.count ?? 0;
  const missing_mileage_km = mileageRes.count ?? 0;
  const missing_engine_key = (engineKeyNullRes.count ?? 0) + (engineKeyEmptyRes.count ?? 0);

  const rows = (engineKeyRowsRes.data ?? []) as { engine_key: string | null }[];
  const byKey = new Map<string, number>();
  for (const r of rows) {
    const k = r.engine_key != null && String(r.engine_key).trim() !== "" ? String(r.engine_key).trim() : "(null)";
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
  }
  const top_engine_keys = Array.from(byKey.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ENGINE_KEY_LIMIT)
    .map(([key, count]) => ({ key, count }));

  return {
    total,
    missing_model_key,
    missing_price_czk,
    missing_year,
    missing_mileage_km,
    missing_engine_key,
    top_engine_keys,
  };
}

/**
 * Zaloguje quality summary do konzole ve formátu [ingest][quality] key=value.
 */
export function logSautoQualitySummary(summary: SautoQualitySummary): void {
  const p = (key: string, value: string | number) =>
    console.log(`[ingest][quality] ${key}=${value}`);
  p("total", summary.total);
  p("model_key_missing", summary.missing_model_key);
  p("price_missing", summary.missing_price_czk);
  p("year_missing", summary.missing_year);
  p("mileage_km_missing", summary.missing_mileage_km);
  p("engine_key_missing", summary.missing_engine_key);
  for (const { key, count } of summary.top_engine_keys) {
    p("engine_key_top", `${key}:${count}`);
  }
}
