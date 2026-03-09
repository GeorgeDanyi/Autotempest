import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeDeal } from "@/lib/pricing/dealScore";
import { calculateDealScore } from "@/lib/pricing/calculateDealScore";
import { buildBestBucket } from "@/lib/pricing/buckets";
import { computeConfidenceScore } from "@/lib/pricing/confidenceScore";
import {
  getModelYearRange,
  isYearValid,
  isYearRangeValid,
} from "@/lib/pricing/modelYearRange";
import {
  getExpectedBrandForModel,
  isModelBrandValid,
} from "@/lib/pricing/modelBrandValid";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import { validateAnalyzeRanges } from "@/lib/analyze/validateAnalyzeRanges";
import { parseBucketToFilters } from "@/lib/pricing/bucketFilters";

export const runtime = "nodejs";

const MIN_SAMPLE = 3;

function getEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anon,
    hasUrl: Boolean(url),
    hasAnon: Boolean(anon),
  };
}

type IndexRow = {
  model_key: string;
  bucket: string;
  median_price_czk: number | null;
  p25_price_czk: number | null;
  p75_price_czk: number | null;
  sample_size: number | null;
  min_price_czk: number | null;
  max_price_czk: number | null;
};

function percentileCont(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) throw new Error("percentileCont: empty array");
  if (n === 1) return sorted[0];
  const index = (n - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function buildStatsFromPrices(prices: number[]): Omit<IndexRow, "model_key" | "bucket"> {
  const sorted = prices.slice().sort((a, b) => a - b);
  const sample_size = sorted.length;
  return {
    median_price_czk: Math.round(percentileCont(sorted, 0.5)),
    p25_price_czk: Math.round(percentileCont(sorted, 0.25)),
    p75_price_czk: Math.round(percentileCont(sorted, 0.75)),
    sample_size,
    min_price_czk: sorted[0],
    max_price_czk: sorted[sorted.length - 1],
  };
}

export async function GET(req: NextRequest) {
  try {
    const { url, anon, hasUrl, hasAnon } = getEnv();

    if (!url || !anon) {
      return NextResponse.json(
        { ok: false, error: "Missing env", hasUrl, hasAnon },
        { status: 500 },
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const model_key = searchParams.get("model_key")?.trim() ?? "";
    const yearParam = searchParams.get("year")?.trim();
    const yearFromParam =
      searchParams.get("yearFrom")?.trim() ?? searchParams.get("year_from")?.trim() ?? null;
    const yearToParam =
      searchParams.get("yearTo")?.trim() ?? searchParams.get("year_to")?.trim() ?? null;
    const mileageParam = searchParams.get("mileage_km")?.trim();
    const mileageFromParam =
      searchParams.get("mileageFrom")?.trim() ?? searchParams.get("mileage_from")?.trim() ?? null;
    const mileageToParam =
      searchParams.get("mileageTo")?.trim() ?? searchParams.get("mileage_max")?.trim() ?? mileageParam ?? null;
    const engineParam = searchParams.get("engine")?.trim() || searchParams.get("engine_key")?.trim() || null;
    const fuelParamRaw = searchParams.get("fuel")?.trim() || null;
    const fuelParam = fuelParamRaw ? fuelParamRaw.toLowerCase() : null;
    const priceParam = searchParams.get("price_czk");
    const price_czk = priceParam ? Number(priceParam) : null;
    const brandParam = searchParams.get("brand")?.trim() || null;
    const sourceModeParam = searchParams.get("source_mode")?.trim()?.toLowerCase() || null;
    const source_mode: "all_sources" | "sauto_only" =
      sourceModeParam === "sauto_only" ? "sauto_only" : "all_sources";

    if (process.env.NODE_ENV === "development") {
      console.log("[api/price] query params", {
        model_key,
        yearParam,
        yearFromParam,
        yearToParam,
        mileageToParam,
        engineParam,
        fuelParam,
        brandParam,
      });
    }

    const yearNum = yearParam ? parseInt(yearParam, 10) : null;
    const singleYear = yearNum != null && !Number.isNaN(yearNum) ? yearNum : null;
    const yearFrom =
      yearFromParam != null && yearFromParam !== ""
        ? parseInt(yearFromParam, 10)
        : singleYear;
    const yearTo =
      yearToParam != null && yearToParam !== ""
        ? parseInt(yearToParam, 10)
        : singleYear;
    const yearForBucket = singleYear ?? (yearFrom != null ? yearFrom : null);

    const mileageFromRaw =
      mileageFromParam != null && mileageFromParam !== ""
        ? parseInt(mileageFromParam.replace(/\D/g, ""), 10)
        : null;
    const mileageToRaw =
      mileageToParam != null && mileageToParam !== ""
        ? parseInt(mileageToParam.replace(/\D/g, ""), 10)
        : null;
    const mileageFromNum =
      mileageFromRaw != null && !Number.isNaN(mileageFromRaw) && mileageFromRaw >= 0
        ? mileageFromRaw
        : null;
    const mileageToNum =
      mileageToRaw != null && !Number.isNaN(mileageToRaw) && mileageToRaw >= 0
        ? mileageToRaw
        : null;
    const mileage_km = mileageToNum;

    const rangeValidation = validateAnalyzeRanges({
      yearFrom: yearFrom ?? undefined,
      yearTo: yearTo ?? undefined,
      mileageFrom: mileageFromNum ?? undefined,
      mileageTo: mileageToNum ?? undefined,
    });
    if (!rangeValidation.ok) {
      if (rangeValidation.reason === "INVALID_YEAR_RANGE_ORDER") {
        return NextResponse.json({
          ok: true,
          data: null,
          reason: "INVALID_YEAR_RANGE_ORDER",
          error: "Year from cannot be greater than year to",
          requested_year_from: yearFromParam ?? undefined,
          requested_year_to: yearToParam ?? undefined,
        });
      }
      return NextResponse.json({
        ok: true,
        data: null,
        reason: "INVALID_MILEAGE_RANGE_ORDER",
        error: "Mileage from cannot be greater than mileage to",
        requested_mileage_from: mileageFromParam ?? undefined,
        requested_mileage_to: mileageToParam ?? undefined,
      });
    }

    const engine_key = engineParam != null && engineParam !== "" ? engineParam : null;

    if (!model_key) {
      return NextResponse.json(
        { ok: false, error: "Invalid query params", details: "Missing model_key" },
        { status: 400 },
      );
    }

    const supabase = createClient(url, anon, { auth: { persistSession: false } });

    const hasRequestedYear =
      (singleYear != null && Number.isFinite(singleYear)) ||
      (yearFrom != null && Number.isFinite(yearFrom)) ||
      (yearTo != null && Number.isFinite(yearTo));

    if (hasRequestedYear) {
      const range = await getModelYearRange(supabase, model_key);
      if (range) {
        const validSingle = singleYear == null || isYearValid(singleYear, range);
        const validRange = isYearRangeValid(yearFrom, yearTo, range);
        if (!validSingle || !validRange) {
          const requested_year = singleYear ?? yearFrom ?? yearTo ?? null;
          if (process.env.NODE_ENV === "development") {
            console.log("[api/price] INVALID_MODEL_YEAR_RANGE", {
              model_key,
              observed_min_year: range.minYear,
              observed_max_year: range.maxYear,
              requested_year,
              yearFrom,
              yearTo,
            });
          }
          return NextResponse.json({
            ok: true,
            data: null,
            reason: "INVALID_MODEL_YEAR_RANGE",
            error: "Selected year is outside the observed range for this model",
            model_key,
            requested_year: requested_year ?? undefined,
            requested_year_from: yearFrom ?? undefined,
            requested_year_to: yearTo ?? undefined,
            observed_min_year: range.minYear,
            observed_max_year: range.maxYear,
          });
        }
      }
    }

    if (brandParam != null && brandParam.trim() !== "") {
      const expectedBrand = await getExpectedBrandForModel(supabase, model_key);
      const requestedBrandKey = normalizeBrandKey(brandParam);
      if (expectedBrand != null && !isModelBrandValid(expectedBrand, requestedBrandKey)) {
        if (process.env.NODE_ENV === "development") {
          console.log("[api/price] INVALID_MODEL_BRAND_COMBINATION", {
            model_key,
            requested_brand: requestedBrandKey,
            expected_brand: expectedBrand,
          });
        }
        return NextResponse.json({
          ok: true,
          data: null,
          reason: "INVALID_MODEL_BRAND_COMBINATION",
          error: "Selected model does not belong to selected brand",
          model_key,
          requested_brand: requestedBrandKey,
          expected_brand: expectedBrand,
        });
      }
    }

    const { bestBucket, fallbackChain, exactMileageMatch } = buildBestBucket({
      year: yearForBucket,
      mileage_km,
      mileageFrom: mileageFromNum,
      mileageTo: mileageToNum,
      engine_key,
    });
    const requested_bucket = fallbackChain[0] ?? "all";

    if (process.env.NODE_ENV === "development") {
      console.log("[api/price] requested bucket", requested_bucket);
    }

    async function fetchFromCache(bucket: string): Promise<IndexRow | null> {
      const { data, error } = await supabase
        .from("price_index_cache")
        .select("model_key, bucket, median_price_czk, p25_price_czk, p75_price_czk, sample_size, min_price_czk, max_price_czk")
        .eq("model_key", model_key)
        .eq("bucket", bucket)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      const row = data as IndexRow;
      if (row.sample_size == null || row.sample_size < MIN_SAMPLE) return null;
      return row;
    }

    let resolved_bucket: string = requested_bucket;
    let stats: IndexRow | null = null;
    let fallback_used = false;
    let statsFromCache = false;

    if (source_mode === "sauto_only") {
      // Cache je sestaven z všech zdrojů; při sauto_only počítáme vždy z market_observations.
      // Neskáčeme do cache, půjdeme do live path s filtrem source=sauto.
    } else {
      for (const bucket of fallbackChain) {
        const row = await fetchFromCache(bucket);
        if (row) {
          stats = row;
          resolved_bucket = bucket;
          fallback_used = bucket !== requested_bucket;
          statsFromCache = true;
          break;
        }
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[api/price] resolved bucket", resolved_bucket, "from cache", !!stats);
    }

    type ObsRow = { price_czk: number | null; source?: string | null };
    let sourceBreakdown: { sauto: number; tipcars: number } | null = null;

    if (!stats) {
      const now = new Date();
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sinceIso = since.toISOString();

      let obsQuery = supabase
        .from("market_observations")
        .select("price_czk, source")
        .eq("model_key", model_key)
        .eq("active", true)
        .gte("observed_at", sinceIso);

      if (source_mode === "sauto_only") obsQuery = obsQuery.eq("source", "sauto");
      if (yearFrom != null && !Number.isNaN(yearFrom)) obsQuery = obsQuery.gte("year", yearFrom);
      if (yearTo != null && !Number.isNaN(yearTo)) obsQuery = obsQuery.lte("year", yearTo);
      if (mileageFromNum != null) obsQuery = obsQuery.gte("mileage_km", mileageFromNum);
      if (mileageToNum != null) obsQuery = obsQuery.lte("mileage_km", mileageToNum);
      if (engine_key) obsQuery = obsQuery.eq("engine_key", engine_key);
      if (fuelParam) obsQuery = obsQuery.eq("fuel", fuelParam);

      const { data: observations, error: obsError } = await obsQuery;

      if (obsError) {
        if (process.env.NODE_ENV === "development") {
          console.log("[api/price] error", obsError.message);
        }
        return NextResponse.json(
          { ok: false, error: obsError.message, step: "observations" },
          { status: 500 },
        );
      }

      const rows = (observations ?? []) as ObsRow[];
      const prices = rows
        .map((row) => row.price_czk)
        .filter((n): n is number => n != null && Number.isFinite(n));

      if (prices.length < MIN_SAMPLE) {
        if (process.env.NODE_ENV === "development") {
          console.log("[api/price] returning no-data", "sample_size", prices.length);
        }
        return NextResponse.json({
          ok: true,
          model_key,
          data: null,
          reason: "NO_DATA",
          sample_size: prices.length,
          sample_size_by_source: source_mode === "sauto_only" ? { sauto: prices.length, tipcars: 0 } : null,
          source_mode,
          error: "Not enough observations for this segment",
        });
      }

      const bySource = { sauto: 0, tipcars: 0 };
      for (const r of rows) {
        const s = (r.source ?? "").toLowerCase();
        if (s === "sauto") bySource.sauto += 1;
        else if (s === "tipcars") bySource.tipcars += 1;
      }
      sourceBreakdown = bySource;

      const computed = buildStatsFromPrices(prices);
      stats = {
        model_key,
        bucket: resolved_bucket,
        ...computed,
      };
      resolved_bucket = "all";
      fallback_used = requested_bucket !== "all";
    }

    if (stats && sourceBreakdown === null && source_mode === "all_sources") {
      const now = new Date();
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sinceIso = since.toISOString();
      const bucketFilters = statsFromCache ? parseBucketToFilters(resolved_bucket) : null;
      const useBucketFilters = statsFromCache && bucketFilters && (bucketFilters.mileageMin != null || bucketFilters.yearFrom != null);
      let countQuery = supabase
        .from("market_observations")
        .select("source")
        .eq("model_key", model_key)
        .eq("active", true)
        .gte("observed_at", sinceIso);
      if (useBucketFilters && bucketFilters) {
        if (bucketFilters.yearFrom != null) countQuery = countQuery.gte("year", bucketFilters.yearFrom);
        if (bucketFilters.yearTo != null) countQuery = countQuery.lte("year", bucketFilters.yearTo);
        if (bucketFilters.mileageMin != null) countQuery = countQuery.gte("mileage_km", bucketFilters.mileageMin);
        if (bucketFilters.mileageMax != null) countQuery = countQuery.lt("mileage_km", bucketFilters.mileageMax);
        if (bucketFilters.engineKey != null) countQuery = countQuery.eq("engine_key", bucketFilters.engineKey);
      } else {
        if (yearFrom != null && !Number.isNaN(yearFrom)) countQuery = countQuery.gte("year", yearFrom);
        if (yearTo != null && !Number.isNaN(yearTo)) countQuery = countQuery.lte("year", yearTo);
        if (mileageFromNum != null) countQuery = countQuery.gte("mileage_km", mileageFromNum);
        if (mileageToNum != null) countQuery = countQuery.lte("mileage_km", mileageToNum);
        if (engine_key) countQuery = countQuery.eq("engine_key", engine_key);
      }
      if (fuelParam) countQuery = countQuery.eq("fuel", fuelParam);
      const { data: sourceRows } = await countQuery.limit(50_000);
      const rows = (sourceRows ?? []) as { source?: string | null }[];
      const bySource = { sauto: 0, tipcars: 0, other: 0 };
      for (const r of rows) {
        const s = (r.source ?? "").toLowerCase();
        if (s === "sauto") bySource.sauto += 1;
        else if (s === "tipcars") bySource.tipcars += 1;
        else bySource.other += 1;
      }
      const countTotal = bySource.sauto + bySource.tipcars + bySource.other;
      const cacheTotal = stats.sample_size ?? 0;
      if (statsFromCache && countTotal !== cacheTotal) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[api/price] sample_size_by_source invariant: count total", countTotal, "!== cache sample_size", cacheTotal, "resolved_bucket", resolved_bucket);
        }
        sourceBreakdown = null;
      } else {
        sourceBreakdown = bySource.other > 0 ? bySource : { sauto: bySource.sauto, tipcars: bySource.tipcars };
      }
    }
    if (stats && source_mode === "sauto_only" && sourceBreakdown === null) {
      sourceBreakdown = { sauto: stats.sample_size ?? 0, tipcars: 0 };
    }

    const sample_size = stats.sample_size ?? 0;
    const { confidence_score, confidence_label, data_quality_note } = computeConfidenceScore({
      sample_size: stats.sample_size,
      requested_bucket,
      resolved_bucket,
      fallback_used,
      fallback_chain: fallbackChain,
    });
    const marketMedianForDeal = stats.median_price_czk ?? null;

    const {
      dealScore,
      dealLabel,
      priceDeltaCzk,
      priceDeltaPct,
    } = calculateDealScore({
      inputPriceCzk: price_czk,
      marketMedianPriceCzk: marketMedianForDeal,
    });

    const { deal_score, deal_label } = computeDeal({
      price_czk,
      p25_price_czk: stats.p25_price_czk,
      median_price_czk: stats.median_price_czk,
      p75_price_czk: stats.p75_price_czk,
      sample_size: stats.sample_size,
    });

    const segment_mode: "exact" | "fallback" =
      statsFromCache
        ? resolved_bucket === requested_bucket && exactMileageMatch
          ? "exact"
          : "fallback"
        : "exact";

    const body = {
      ok: true,
      model_key,
      requested_bucket,
      resolved_bucket,
      segment_mode,
      sample_size: stats.sample_size,
      sample_size_total: stats.sample_size,
      sample_size_by_source: sourceBreakdown ?? undefined,
      source_mode,
      confidence_score,
      confidence_label,
      data_quality_note,
      median_price_czk: stats.median_price_czk,
      p25_price_czk: stats.p25_price_czk,
      p75_price_czk: stats.p75_price_czk,
      min_price_czk: stats.min_price_czk,
      max_price_czk: stats.max_price_czk,
      fallback_used,
      input_price_czk: price_czk,
      deal_score,
      deal_label,
      dealScore,
      dealLabel,
      priceDeltaCzk,
      priceDeltaPct,
      engine_key: engine_key ?? undefined,
      brand: brandParam ?? undefined,
      year_from: yearFrom ?? undefined,
      year_to: yearTo ?? undefined,
      requested_mileage_from: mileageFromNum ?? undefined,
      requested_mileage_to: mileageToNum ?? undefined,
      applied_mileage_from:
        segment_mode === "exact" ? (mileageFromNum ?? undefined) : undefined,
      applied_mileage_to:
        segment_mode === "exact" ? (mileageToNum ?? undefined) : undefined,
      mileage_max_km: mileageToNum ?? undefined,
    };

    if (process.env.NODE_ENV === "development") {
      console.log("[api/price] returning success", "sample_size", body.sample_size);
      if (body.sample_size_by_source) {
        const bySource = body.sample_size_by_source as {
          sauto?: number;
          tipcars?: number;
          other?: number;
        };
        const sum =
          (bySource.sauto ?? 0) +
          (bySource.tipcars ?? 0) +
          (bySource.other ?? 0);
        const total = body.sample_size_total ?? body.sample_size ?? 0;
        if (sum !== total) {
          console.warn(
            "[api/price] sample_size_by_source invariant: sum",
            sum,
            "!== sample_size_total",
            total,
          );
        }
      }
    }
    return NextResponse.json(body);
  } catch (e) {
    const err = e as Error;
    if (process.env.NODE_ENV === "development") {
      console.error("[api/price] error", err.message, err.stack);
    }
    return NextResponse.json(
      {
        ok: false,
        error: err.message ?? "Internal server error",
        step: "handler",
      },
      { status: 500 },
    );
  }
}
