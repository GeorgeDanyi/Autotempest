/**
 * Jednotný quality summary pro ingest – použitelný pro Sauto i TipCars.
 * Po doběhu ingestu zobrazí total saved, pricing_ready_count, missing pole, top brands/models/engine_key.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isObservationPricingReady } from "./pricingReady";

const TOP_LIMIT = 10;
const SAMPLE_LIMIT = 15_000;

export type IngestQualitySummary = {
  source: string;
  total: number;
  pricing_ready_count: number;
  pricing_ready_ratio: number;
  missing_model_key: number;
  missing_price_czk: number;
  missing_year: number;
  missing_mileage_km: number;
  missing_fuel: number;
  missing_engine_key: number;
  top_brands: { brand: string; count: number }[];
  top_models: { model_key: string; count: number }[];
  top_engine_keys: { key: string; count: number }[];
};

type DbRow = {
  model_key: string | null;
  price_czk: number | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  engine_key: string | null;
  brand: string | null;
};

/**
 * Načte quality summary pro daný source z market_observations.
 */
export async function getIngestQualitySummary(
  supabase: SupabaseClient,
  source: string
): Promise<IngestQualitySummary> {
  const [
    totalRes,
    modelKeyNullRes,
    modelKeyEmptyRes,
    priceRes,
    yearRes,
    mileageRes,
    fuelNullRes,
    engineKeyNullRes,
    engineKeyEmptyRes,
    pricingReadyRes,
    sampleRes,
  ] = await Promise.all([
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .is("model_key", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .eq("model_key", ""),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .is("price_czk", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .is("year", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .is("mileage_km", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .is("fuel", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .is("engine_key", null),
    supabase
      .from("market_observations")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .eq("engine_key", ""),
    supabase
      .from("market_observations")
      .select("id", { count: "exact", head: true })
      .eq("source", source)
      .not("model_key", "is", null)
      .neq("model_key", "")
      .not("price_czk", "is", null)
      .gt("price_czk", 0)
      .not("year", "is", null)
      .not("mileage_km", "is", null),
    supabase
      .from("market_observations")
      .select("model_key, price_czk, year, mileage_km, fuel, engine_key, brand")
      .eq("source", source)
      .limit(SAMPLE_LIMIT),
  ]);

  const total = totalRes.count ?? 0;
  const missing_model_key =
    (modelKeyNullRes.count ?? 0) + (modelKeyEmptyRes.count ?? 0);
  const missing_price_czk = priceRes.count ?? 0;
  const missing_year = yearRes.count ?? 0;
  const missing_mileage_km = mileageRes.count ?? 0;
  const missing_fuel = fuelNullRes.count ?? 0;
  const missing_engine_key =
    (engineKeyNullRes.count ?? 0) + (engineKeyEmptyRes.count ?? 0);
  const pricing_ready_count = pricingReadyRes.count ?? 0;
  const pricing_ready_ratio = total > 0 ? pricing_ready_count / total : 0;

  const rows = (sampleRes.data ?? []) as DbRow[];
  let computedPricingReady = 0;
  const byBrand = new Map<string, number>();
  const byModel = new Map<string, number>();
  const byEngineKey = new Map<string, number>();

  for (const r of rows) {
    if (isObservationPricingReady(r)) computedPricingReady += 1;
    const brand =
      r.brand != null && String(r.brand).trim() !== ""
        ? String(r.brand).trim()
        : "(null)";
    byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1);
    const modelKey =
      r.model_key != null && String(r.model_key).trim() !== ""
        ? String(r.model_key).trim()
        : "(null)";
    byModel.set(modelKey, (byModel.get(modelKey) ?? 0) + 1);
    const ek =
      r.engine_key != null && String(r.engine_key).trim() !== ""
        ? String(r.engine_key).trim()
        : "(null)";
    byEngineKey.set(ek, (byEngineKey.get(ek) ?? 0) + 1);
  }

  const top_brands = Array.from(byBrand.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([brand, count]) => ({ brand, count }));

  const top_models = Array.from(byModel.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([model_key, count]) => ({ model_key, count }));

  const top_engine_keys = Array.from(byEngineKey.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([key, count]) => ({ key, count }));

  return {
    source,
    total,
    pricing_ready_count,
    pricing_ready_ratio,
    missing_model_key,
    missing_price_czk,
    missing_year,
    missing_mileage_km,
    missing_fuel,
    missing_engine_key,
    top_brands,
    top_models,
    top_engine_keys,
  };
}

/**
 * Zaloguje quality summary do konzole (jednotný formát pro oba zdroje).
 */
export function logIngestQualitySummary(summary: IngestQualitySummary): void {
  const p = (key: string, value: string | number) =>
    console.log(`[ingest][quality][${summary.source}] ${key}=${value}`);
  p("total", summary.total);
  p("pricing_ready_count", summary.pricing_ready_count);
  p("pricing_ready_ratio", summary.pricing_ready_ratio.toFixed(2));
  p("missing_model_key", summary.missing_model_key);
  p("missing_price_czk", summary.missing_price_czk);
  p("missing_year", summary.missing_year);
  p("missing_mileage_km", summary.missing_mileage_km);
  p("missing_fuel", summary.missing_fuel);
  p("missing_engine_key", summary.missing_engine_key);
  for (const { brand, count } of summary.top_brands) {
    p("brand_top", `${brand}:${count}`);
  }
  for (const { model_key, count } of summary.top_models) {
    p("model_top", `${model_key}:${count}`);
  }
  for (const { key, count } of summary.top_engine_keys) {
    p("engine_key_top", `${key}:${count}`);
  }
}

/** Quality summary pro jeden model_key (po model-specific ingestu). */
export type ModelKeyQualitySummary = {
  source: string;
  model_key: string;
  total_rows: number;
  pricing_ready_rows: number;
  missing_mileage_km: number;
  missing_engine_key: number;
  missing_year: number;
  min_year: number | null;
  max_year: number | null;
  min_price_czk: number | null;
  max_price_czk: number | null;
  median_price_czk: number | null;
};

const MEDIAN_SAMPLE_LIMIT = 2000;

/**
 * Načte quality summary jen pro daný model_key (a source).
 * median_price_czk je přibližný (vzorek až MEDIAN_SAMPLE_LIMIT řádků).
 */
export async function getIngestQualitySummaryForModelKey(
  supabase: SupabaseClient,
  source: string,
  model_key: string
): Promise<ModelKeyQualitySummary> {
  const [
    totalRes,
    pricingReadyRes,
    missingMileageRes,
    missingEngineNullRes,
    missingEngineEmptyRes,
    missingYearRes,
    minYearRow,
    maxYearRow,
    minPriceRow,
    maxPriceRow,
    priceSampleRes,
  ] = await Promise.all([
    supabase.from("market_observations").select("id", { count: "exact", head: true }).eq("source", source).eq("model_key", model_key),
    supabase.from("market_observations").select("id", { count: "exact", head: true }).eq("source", source).eq("model_key", model_key)
      .not("price_czk", "is", null)
      .gt("price_czk", 0)
      .not("year", "is", null)
      .not("mileage_km", "is", null)
      .not("model_key", "is", null)
      .neq("model_key", "")
      ,
    supabase.from("market_observations").select("id", { count: "exact", head: true }).eq("source", source).eq("model_key", model_key).is("mileage_km", null),
    supabase.from("market_observations").select("id", { count: "exact", head: true }).eq("source", source).eq("model_key", model_key).is("engine_key", null),
    supabase.from("market_observations").select("id", { count: "exact", head: true }).eq("source", source).eq("model_key", model_key).eq("engine_key", ""),
    supabase.from("market_observations").select("id", { count: "exact", head: true }).eq("source", source).eq("model_key", model_key).is("year", null),
    supabase.from("market_observations").select("year").eq("source", source).eq("model_key", model_key).not("year", "is", null).order("year", { ascending: true }).limit(1),
    supabase.from("market_observations").select("year").eq("source", source).eq("model_key", model_key).not("year", "is", null).order("year", { ascending: false }).limit(1),
    supabase.from("market_observations").select("price_czk").eq("source", source).eq("model_key", model_key).not("price_czk", "is", null).order("price_czk", { ascending: true }).limit(1),
    supabase.from("market_observations").select("price_czk").eq("source", source).eq("model_key", model_key).not("price_czk", "is", null).order("price_czk", { ascending: false }).limit(1),
    supabase.from("market_observations").select("price_czk").eq("source", source).eq("model_key", model_key).not("price_czk", "is", null).order("price_czk", { ascending: true }).limit(MEDIAN_SAMPLE_LIMIT),
  ]);

  const total_rows = totalRes.count ?? 0;
  const pricing_ready_rows = pricingReadyRes.count ?? 0;
  const missing_mileage_km = missingMileageRes.count ?? 0;
  const missing_engine_key = (missingEngineNullRes.count ?? 0) + (missingEngineEmptyRes.count ?? 0);
  const missing_year = missingYearRes.count ?? 0;

  const min_year = (minYearRow.data?.[0] as { year: number } | undefined)?.year ?? null;
  const max_year = (maxYearRow.data?.[0] as { year: number } | undefined)?.year ?? null;
  const min_price_czk = (minPriceRow.data?.[0] as { price_czk: number } | undefined)?.price_czk ?? null;
  const max_price_czk = (maxPriceRow.data?.[0] as { price_czk: number } | undefined)?.price_czk ?? null;

  const prices = ((priceSampleRes.data ?? []) as { price_czk: number }[])
    .map((r) => r.price_czk)
    .filter((n) => n != null && Number.isFinite(n))
    .sort((a, b) => a - b);
  let median_price_czk: number | null = null;
  if (prices.length > 0) {
    const mid = Math.floor(prices.length / 2);
    median_price_czk =
      prices.length % 2 === 1 ? prices[mid]! : (prices[mid - 1]! + prices[mid]!) / 2;
  }

  return {
    source,
    model_key,
    total_rows,
    pricing_ready_rows,
    missing_mileage_km,
    missing_engine_key,
    missing_year,
    min_year,
    max_year,
    min_price_czk,
    max_price_czk,
    median_price_czk,
  };
}

export function logModelKeyQualitySummary(s: ModelKeyQualitySummary): void {
  const p = (key: string, value: string | number | null) =>
    console.log(`[ingest][quality][${s.source}][model_key=${s.model_key}] ${key}=${value ?? "null"}`);
  p("total_rows", s.total_rows);
  p("pricing_ready_rows", s.pricing_ready_rows);
  p("missing_mileage_km", s.missing_mileage_km);
  p("missing_engine_key", s.missing_engine_key);
  p("missing_year", s.missing_year);
  p("min_year", s.min_year);
  p("max_year", s.max_year);
  p("min_price_czk", s.min_price_czk);
  p("max_price_czk", s.max_price_czk);
  p("median_price_czk", s.median_price_czk);
}
