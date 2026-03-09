import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Bucket, MileageBucket, YearBucket } from "@/lib/pricing/buckets";

type RebuildResult =
  | { ok: true; upserted: number; sample_size: number }
  | { ok: false; error: string };

function percentileCont(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const i = (n - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  const frac = i - lo;
  const a = sorted[lo];
  const b = sorted[hi];
  return a + (b - a) * frac;
}

function toInt(n: number): number {
  return Math.round(Number(n));
}

export async function rebuildModelIndex(params: {
  model_key: string;
  bucket?: string; // default "all", can be composite (year__mileage)
  lookbackDays?: number; // default 30
}): Promise<RebuildResult> {
  const model_key = params.model_key;
  const bucket = params.bucket ?? "all";
  const lookbackDays = params.lookbackDays ?? 30;

  try {
    const supabase = getSupabaseAdmin();

    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("market_observations")
      .select("price_czk, year, mileage_km")
      .eq("model_key", model_key)
      .gte("observed_at", since);

    // Rozparsuju bucket na části: year a mileage (pokud je composite "year__mileage")
    let yearPart: Bucket | YearBucket | undefined;
    let mileagePart: MileageBucket | undefined;

    if (bucket.includes("__")) {
      const [yearStr, mileageStr] = bucket.split("__");
      yearPart = yearStr as Bucket;
      mileagePart = mileageStr as MileageBucket;
    } else {
      yearPart = bucket as Bucket;
    }

    // Filtr podle roku
    if (yearPart === "year_2022_plus") {
      query = query.gte("year", 2022);
    } else if (yearPart === "year_2019_2021") {
      query = query.gte("year", 2019).lte("year", 2021);
    } else if (yearPart === "year_2016_2018") {
      query = query.gte("year", 2016).lte("year", 2018);
    } else if (yearPart === "year_2012_2015") {
      query = query.gte("year", 2012).lte("year", 2015);
    } else if (yearPart === "year_2008_2011") {
      query = query.gte("year", 2008).lte("year", 2011);
    } else if (yearPart === "unknown_year") {
      query = query.is("year", null);
    }

    // Filtr podle nájezdu (nové bucket: 0–50k, 50–100k, …, 250k+)
    if (mileagePart === "mileage_0_50k") {
      query = query.lt("mileage_km", 50_000);
    } else if (mileagePart === "mileage_50_100k") {
      query = query.gte("mileage_km", 50_000).lt("mileage_km", 100_000);
    } else if (mileagePart === "mileage_100_150k") {
      query = query.gte("mileage_km", 100_000).lt("mileage_km", 150_000);
    } else if (mileagePart === "mileage_150_200k") {
      query = query.gte("mileage_km", 150_000).lt("mileage_km", 200_000);
    } else if (mileagePart === "mileage_200_250k") {
      query = query.gte("mileage_km", 200_000).lt("mileage_km", 250_000);
    } else if (mileagePart === "mileage_250k_plus") {
      query = query.gte("mileage_km", 250_000);
    } else if (mileagePart === "unknown_mileage") {
      query = query.is("mileage_km", null);
    }

    const { data, error } = await query;

    if (error) return { ok: false, error: error.message };

    const prices = (data ?? [])
      .map((r: any) => Number(r.price_czk))
      .filter((n: number) => Number.isFinite(n))
      .sort((a: number, b: number) => a - b);

    const sample_size = prices.length;
    if (sample_size === 0) {
      return { ok: true, upserted: 0, sample_size: 0 };
    }

    const min_price_czk = prices[0];
    const max_price_czk = prices[prices.length - 1];

    const p25_price_czk = Math.round(percentileCont(prices, 0.25));
    const median_price_czk = Math.round(percentileCont(prices, 0.5));
    const p75_price_czk = Math.round(percentileCont(prices, 0.75));

    const computed_at = new Date().toISOString();

    const row = {
      model_key,
      bucket,
      median_price_czk: toInt(median_price_czk),
      p25_price_czk: toInt(p25_price_czk),
      p75_price_czk: toInt(p75_price_czk),
      sample_size: toInt(sample_size),
      min_price_czk: toInt(min_price_czk),
      max_price_czk: toInt(max_price_czk),
      computed_at,
    };

    const { error: upsertErr } = await supabase
      .from("price_index_cache")
      .upsert(row, { onConflict: "model_key,bucket" });

    if (upsertErr) return { ok: false, error: upsertErr.message };

    return { ok: true, upserted: 1, sample_size };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error" };
  }
}

