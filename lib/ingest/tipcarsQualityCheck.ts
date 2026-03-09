/**
 * Quality check po TipCars ingestu – přehled kvality dat v market_observations pro source = "tipcars".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const TOP_LIMIT = 10;
const SAMPLE_LIMIT = 15_000;

export type TipcarsQualitySummary = {
  total: number;
  missing_model_key: number;
  missing_price_czk: number;
  missing_year: number;
  missing_mileage_km: number;
  missing_engine_key: number;
  /** Počet záznamů s model_key + price_czk + year + mileage_km (použitelné pro pricing) */
  usable_for_pricing: number;
  top_engine_keys: { key: string; count: number }[];
  top_brands: { brand: string; count: number }[];
  top_models: { model_key: string; count: number }[];
};

export async function getTipcarsQualitySummary(
  supabase: SupabaseClient
): Promise<TipcarsQualitySummary> {
  const [
    totalRes,
    modelKeyNullRes,
    modelKeyEmptyRes,
    priceRes,
    yearRes,
    mileageRes,
    engineKeyNullRes,
    engineKeyEmptyRes,
    usableRes,
    engineKeyRowsRes,
    brandRowsRes,
    modelRowsRes,
  ] = await Promise.all([
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars"),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars")
      .is("model_key", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars")
      .eq("model_key", ""),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars")
      .is("price_czk", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars")
      .is("year", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars")
      .is("mileage_km", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars")
      .is("engine_key", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", "tipcars")
      .eq("engine_key", ""),
    supabase
      .from("market_observations")
      .select("id", { count: "exact", head: true })
      .eq("source", "tipcars")
      .not("model_key", "is", null)
      .not("price_czk", "is", null)
      .not("year", "is", null)
      .not("mileage_km", "is", null),
    supabase
      .from("market_observations")
      .select("engine_key")
      .eq("source", "tipcars")
      .limit(SAMPLE_LIMIT),
    supabase
      .from("market_observations")
      .select("brand")
      .eq("source", "tipcars")
      .limit(SAMPLE_LIMIT),
    supabase
      .from("market_observations")
      .select("model_key")
      .eq("source", "tipcars")
      .limit(SAMPLE_LIMIT),
  ]);

  const total = totalRes.count ?? 0;
  const missing_model_key =
    (modelKeyNullRes.count ?? 0) + (modelKeyEmptyRes.count ?? 0);
  const missing_price_czk = priceRes.count ?? 0;
  const missing_year = yearRes.count ?? 0;
  const missing_mileage_km = mileageRes.count ?? 0;
  const missing_engine_key =
    (engineKeyNullRes.count ?? 0) + (engineKeyEmptyRes.count ?? 0);
  const usable_for_pricing = usableRes.count ?? 0;

  const engineRows = (engineKeyRowsRes.data ?? []) as { engine_key: string | null }[];
  const byEngineKey = new Map<string, number>();
  for (const r of engineRows) {
    const k =
      r.engine_key != null && String(r.engine_key).trim() !== ""
        ? String(r.engine_key).trim()
        : "(null)";
    byEngineKey.set(k, (byEngineKey.get(k) ?? 0) + 1);
  }
  const top_engine_keys = Array.from(byEngineKey.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([key, count]) => ({ key, count }));

  const brandRows = (brandRowsRes.data ?? []) as { brand: string | null }[];
  const byBrand = new Map<string, number>();
  for (const r of brandRows) {
    const b = r.brand != null && String(r.brand).trim() !== "" ? String(r.brand).trim() : "(null)";
    byBrand.set(b, (byBrand.get(b) ?? 0) + 1);
  }
  const top_brands = Array.from(byBrand.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([brand, count]) => ({ brand, count }));

  const modelRows = (modelRowsRes.data ?? []) as { model_key: string | null }[];
  const byModel = new Map<string, number>();
  for (const r of modelRows) {
    const m =
      r.model_key != null && String(r.model_key).trim() !== ""
        ? String(r.model_key).trim()
        : "(null)";
    byModel.set(m, (byModel.get(m) ?? 0) + 1);
  }
  const top_models = Array.from(byModel.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([model_key, count]) => ({ model_key, count }));

  return {
    total,
    missing_model_key,
    missing_price_czk,
    missing_year,
    missing_mileage_km,
    missing_engine_key,
    usable_for_pricing,
    top_engine_keys,
    top_brands,
    top_models,
  };
}

export function logTipcarsQualitySummary(summary: TipcarsQualitySummary): void {
  const p = (key: string, value: string | number) =>
    console.log(`[ingest][quality][tipcars] ${key}=${value}`);
  p("total", summary.total);
  p("total_parsed", summary.total);
  p("model_key_missing", summary.missing_model_key);
  p("year_missing", summary.missing_year);
  p("mileage_km_missing", summary.missing_mileage_km);
  p("price_missing", summary.missing_price_czk);
  p("engine_key_missing", summary.missing_engine_key);
  p("usable_for_pricing", summary.usable_for_pricing);
  for (const { key, count } of summary.top_engine_keys) {
    p("engine_key_top", `${key}:${count}`);
  }
  for (const { brand, count } of summary.top_brands) {
    p("brand_top", `${brand}:${count}`);
  }
  for (const { model_key, count } of summary.top_models) {
    p("model_top", `${model_key}:${count}`);
  }
}
