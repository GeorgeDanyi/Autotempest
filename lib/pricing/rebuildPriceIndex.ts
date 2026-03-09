import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_ENGINE_BUCKETS,
  ALL_MILEAGE_BUCKETS,
  ALL_YEAR_BUCKETS,
  bucketForYear,
  bucketForMileage,
  buildBucketString,
  engineBucketFromKey,
  type YearBucket,
  type MileageBucket,
} from "@/lib/pricing/buckets";

/** Minimum sample size to consider a bucket "confident" (for API/UI). All rows are stored regardless. */
export const MIN_SAMPLE_FOR_CONFIDENT = 10;

type MarketObservationRow = {
  model_key: string | null;
  price_czk: number | null;
  year: number | null;
  mileage_km: number | null;
  fuel?: string | null;
  /** Legacy; prefer title or engine_raw for fallback. */
  trim?: string | null;
  title?: string | null;
  engine_raw?: string | null;
  engine_key?: string | null;
};

type EnrichedObservation = MarketObservationRow & {
  yearBucket: YearBucket;
  mileageBucket: MileageBucket;
  engine_bucket: string;
};

type PriceIndexRow = {
  model_key: string;
  bucket: string;
  sample_size: number;
  median_price_czk: number;
  p25_price_czk: number;
  p75_price_czk: number;
  min_price_czk: number;
  max_price_czk: number;
  computed_at: string;
};

/**
 * Derive engine_bucket from observation fields (engine_key, engine_raw, fuel, title/trim).
 * If no usable source, returns "engine_unknown".
 */
function deriveEngineBucket(obs: MarketObservationRow): string {
  // Prefer normalized engine_key from ingestion when available.
  if (obs.engine_key) {
    const fromKey = engineBucketFromKey(obs.engine_key);
    if (fromKey) return fromKey;
  }

  const fuel = (obs.fuel ?? "").toLowerCase();
  const rawText = [obs.engine_raw, obs.title, obs.trim].filter(Boolean).join(" ");
  const combined = `${fuel} ${rawText}`.toLowerCase();

  if (/\b(?:hybrid|phev|hev)\b/.test(combined)) return "engine_hybrid";
  if (/\b(?:ev|electric|elektro|bev)\b/.test(combined)) return "engine_ev";
  if (/\b(?:lpg|cng)\b/.test(combined)) return "engine_lpg";

  if (/diesel|nafta|tdi|dci|hdi/.test(combined)) {
    if (/\b2[.,\s]*0\b|20(?:\s*tdi)?/.test(combined)) return "engine_2_0_tdi";
    if (/\b1[.,\s]*9\b|19(?:\s*tdi)?/.test(combined)) return "engine_1_9_tdi";
    if (/\b1[.,\s]*6\b|16(?:\s*tdi)?/.test(combined)) return "engine_1_6_tdi";
    return "engine_unknown";
  }

  if (/benzin|benz[ií]n|petrol|tsi|tfsi|fsi/.test(combined)) {
    if (/\b2[.,\s]*0\b|20(?:\s*tsi)?/.test(combined)) return "engine_2_0_tsi";
    if (/\b1[.,\s]*4\b|14(?:\s*tsi)?/.test(combined)) return "engine_1_4_tsi";
    if (/\b1[.,\s]*5\b|15(?:\s*tsi)?/.test(combined)) return "engine_1_5_tsi";
    return "engine_unknown";
  }

  return "engine_unknown";
}

function percentileCont(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) {
    throw new Error("percentileCont called with empty array");
  }
  if (n === 1) {
    return sorted[0];
  }

  const index = (n - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function toInt(n: number): number {
  return Math.round(Number(n));
}

export async function rebuildPriceIndex(
  supabase: SupabaseClient,
  options?: { modelKeys?: string[] },
): Promise<{ upserted: number }> {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  let query = supabase
    .from("market_observations")
    .select("model_key, price_czk, year, mileage_km, fuel, trim, title, engine_raw, engine_key")
    .eq("active", true)
    .gte("observed_at", sinceIso);

  if (options?.modelKeys && options.modelKeys.length > 0) {
    query = query.in("model_key", options.modelKeys);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`fetch_observations:${error.message}`);
  }

  const rows = (data ?? []) as MarketObservationRow[];

  const byModel = new Map<string, EnrichedObservation[]>();

  for (const row of rows) {
    if (!row.model_key || row.price_czk == null || !Number.isFinite(row.price_czk)) {
      continue;
    }
    const engine_bucket = deriveEngineBucket(row);
    const yearBucket = bucketForYear(row.year);
    const mileageBucket = bucketForMileage(row.mileage_km);
    const enriched: EnrichedObservation = {
      ...row,
      yearBucket,
      mileageBucket,
      engine_bucket,
    };
    const key = row.model_key;
    let arr = byModel.get(key);
    if (!arr) {
      arr = [];
      byModel.set(key, arr);
    }
    arr.push(enriched);
  }

  const upsertRows: PriceIndexRow[] = [];

  function buildBucketRow(
    model_key: string,
    bucket: string,
    observations: { price_czk: number | null }[],
  ): PriceIndexRow | null {
    const prices = observations
      .map((o) => o.price_czk)
      .filter((n): n is number => n != null && Number.isFinite(n));

    if (prices.length < 3) {
      return null;
    }

    const sample_size = prices.length;
    const sorted = prices.slice().sort((a, b) => a - b);

    let trimmed = sorted;
    if (sorted.length >= 20) {
      const cut = Math.floor(sorted.length * 0.05);
      trimmed = sorted.slice(cut, sorted.length - cut);
    }

    const p25_price_czk = percentileCont(trimmed, 0.25);
    const median_price_czk = percentileCont(trimmed, 0.5);
    const p75_price_czk = percentileCont(trimmed, 0.75);
    const min_price_czk = trimmed[0];
    const max_price_czk = trimmed[trimmed.length - 1];

    return {
      model_key,
      bucket,
      sample_size: toInt(sample_size),
      median_price_czk: toInt(median_price_czk),
      p25_price_czk: toInt(p25_price_czk),
      p75_price_czk: toInt(p75_price_czk),
      min_price_czk: toInt(min_price_czk),
      max_price_czk: toInt(max_price_czk),
      computed_at: new Date().toISOString(),
    };
  }

  function filterByYear(obs: EnrichedObservation[], yb: YearBucket): EnrichedObservation[] {
    return obs.filter((o) => o.yearBucket === yb);
  }

  for (const [model_key, observations] of byModel.entries()) {
    if (observations.length < 3) {
      continue;
    }

    // 1) all
    const allRow = buildBucketRow(model_key, "all", observations);
    if (allRow) upsertRows.push(allRow);

    // 2) Legacy year buckets (keep for backward compatibility)
    const year2010Plus = observations.filter(
      (o) => o.year != null && Number.isFinite(o.year) && (o.year as number) >= 2010,
    );
    const year2016Plus = observations.filter(
      (o) => o.year != null && Number.isFinite(o.year) && (o.year as number) >= 2016,
    );
    for (const [yearBucket, base] of [
      ["year_2010_plus", year2010Plus] as const,
      ["year_2016_plus", year2016Plus] as const,
    ]) {
      const row = buildBucketRow(model_key, yearBucket, base);
      if (row) upsertRows.push(row);
      if (base.length >= 3) {
        for (const mb of ALL_MILEAGE_BUCKETS) {
          const subset = base.filter((o) => o.mileageBucket === mb);
          const r = buildBucketRow(model_key, `${yearBucket}__${mb}`, subset);
          if (r) upsertRows.push(r);
        }
      }
    }

    // 3) New year bands: year only
    for (const yb of ALL_YEAR_BUCKETS) {
      if (yb === "unknown_year") continue;
      const subset = filterByYear(observations, yb);
      const row = buildBucketRow(model_key, yb, subset);
      if (row) upsertRows.push(row);
    }

    // 4) year__mileage
    for (const yb of ALL_YEAR_BUCKETS) {
      if (yb === "unknown_year") continue;
      const yearObs = filterByYear(observations, yb);
      if (yearObs.length < 3) continue;
      for (const mb of ALL_MILEAGE_BUCKETS) {
        const subset = yearObs.filter((o) => o.mileageBucket === mb);
        const r = buildBucketRow(model_key, buildBucketString({ yearBucket: yb, mileageBucket: mb }), subset);
        if (r) upsertRows.push(r);
      }
    }

    // 5) year__engine (engine-specific, only when engine_key is present)
    for (const yb of ALL_YEAR_BUCKETS) {
      if (yb === "unknown_year") continue;
      const yearObs = filterByYear(observations, yb);
      const yearObsWithEngine = yearObs.filter((o) => o.engine_key != null);
      if (yearObsWithEngine.length < 3) continue;
      for (const eb of ALL_ENGINE_BUCKETS) {
        const subset = yearObsWithEngine.filter((o) => o.engine_bucket === eb);
        const r = buildBucketRow(model_key, buildBucketString({ yearBucket: yb, engineBucket: eb }), subset);
        if (r) upsertRows.push(r);
      }
    }

    // 6) year__engine__mileage (engine-specific, only when engine_key is present)
    for (const yb of ALL_YEAR_BUCKETS) {
      if (yb === "unknown_year") continue;
      const yearObs = filterByYear(observations, yb);
      const yearObsWithEngine = yearObs.filter((o) => o.engine_key != null);
      if (yearObsWithEngine.length < 3) continue;
      for (const eb of ALL_ENGINE_BUCKETS) {
        const yearEngineObs = yearObsWithEngine.filter((o) => o.engine_bucket === eb);
        if (yearEngineObs.length < 3) continue;
        for (const mb of ALL_MILEAGE_BUCKETS) {
          const subset = yearEngineObs.filter((o) => o.mileageBucket === mb);
          const r = buildBucketRow(
            model_key,
            buildBucketString({ yearBucket: yb, engineBucket: eb, mileageBucket: mb }),
            subset,
          );
          if (r) upsertRows.push(r);
        }
      }
    }
  }

  if (upsertRows.length === 0) {
    return { upserted: 0 };
  }

  const { error: upsertError } = await supabase.from("price_index_cache").upsert(upsertRows, {
    onConflict: "model_key,bucket",
  });

  if (upsertError) {
    throw new Error(`upsert_price_index:${upsertError.message}`);
  }

  const { error: historyError } = await supabase.from("price_history").insert(
    upsertRows.map((row) => ({
      model_key: row.model_key,
      bucket: row.bucket,
      median_price_czk: row.median_price_czk,
      p25_price_czk: row.p25_price_czk,
      p75_price_czk: row.p75_price_czk,
      sample_size: row.sample_size,
      computed_at: row.computed_at,
    })),
  );

  if (historyError) {
    throw new Error(`insert_price_history:${historyError.message}`);
  }

  return { upserted: upsertRows.length };
}
// --- CLI entrypoint (tsx) ---
import { fileURLToPath } from "node:url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function main() {
  console.log("[rebuildPriceIndex] starting…");
  const supabase = getSupabaseAdmin();
  const res = await rebuildPriceIndex(supabase);
  console.log("[rebuildPriceIndex] done:", res);
}

// Spusť jen pokud je to runnuté přímo přes `tsx file.ts`
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  main().catch((e) => {
    console.error("[rebuildPriceIndex] failed:", e);
    process.exit(1);
  });
}
