import type { SupabaseClient } from "@supabase/supabase-js";
import { getMileageBucket as getMileageBucketFromMarketShape } from "@/lib/pricing/marketShape";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ListingForEvaluation = {
  brand?: string | null;
  model?: string | null;
  model_key: string;
  year?: number | null;
  mileage_km?: number | null;
  price_czk: number;
};

export type PriceEvaluation = {
  fair_price: number | null;
  deal_score: number | null;
  price_label: "GREAT DEAL" | "GOOD DEAL" | "FAIR PRICE" | "OVERPRICED" | "NO DATA";
  median_price: number | null;
  p25: number | null;
  p75: number | null;
};

// Year buckets: <2010, 2010-2014, 2015-2019, 2020+
function getYearBucket(year: number | null | undefined): string | null {
  if (year == null || !Number.isFinite(year)) return null;
  const y = year as number;
  if (y < 2010) return "year_lt_2010";
  if (y <= 2014) return "year_2010_2014";
  if (y <= 2019) return "year_2015_2019";
  return "year_2020_plus";
}

function getMileageBucket(mileage_km: number | null | undefined): string | null {
  const bucket = getMileageBucketFromMarketShape(mileage_km);
  return bucket === "unknown_mileage" ? null : bucket;
}

/** Build ordered bucket strings to try (most specific first). */
function getBucketFallbackChain(yearBucket: string | null, mileageBucket: string | null): string[] {
  const chain: string[] = [];
  if (yearBucket && mileageBucket) {
    chain.push(`${yearBucket}__${mileageBucket}`);
  }
  if (yearBucket) chain.push(yearBucket);
  chain.push("all");
  return chain;
}

/** Pure: compute deal_score from price_ratio (listing_price / median_price). */
function dealScoreFromRatio(price_ratio: number): number {
  if (price_ratio < 0.8) return 10;
  if (price_ratio < 0.9) return 9;
  if (price_ratio < 1.0) return 8;
  if (price_ratio < 1.1) return 6;
  if (price_ratio < 1.2) return 4;
  return 2;
}

/** Pure: compute price_label from listing price vs p25, median, p75. */
function priceLabelFromQuantiles(
  listingPrice: number,
  p25: number,
  median: number,
  p75: number,
): "GREAT DEAL" | "GOOD DEAL" | "FAIR PRICE" | "OVERPRICED" {
  if (listingPrice < p25) return "GREAT DEAL";
  if (listingPrice < median) return "GOOD DEAL";
  if (listingPrice <= p75) return "FAIR PRICE";
  return "OVERPRICED";
}

/** Pure: given listing price and cache stats, return evaluation. */
export function computeEvaluation(
  listingPrice: number,
  median_price: number,
  p25: number,
  p75: number,
): Omit<PriceEvaluation, "median_price" | "p25" | "p75"> & {
  median_price: number;
  p25: number;
  p75: number;
} {
  const fair_price = median_price;
  const price_ratio = median_price > 0 ? listingPrice / median_price : 0;
  const deal_score = dealScoreFromRatio(price_ratio);
  const price_label = priceLabelFromQuantiles(listingPrice, p25, median_price, p75);
  return {
    fair_price,
    deal_score,
    price_label,
    median_price,
    p25,
    p75,
  };
}

type CacheRow = {
  median_price_czk: number | null;
  p25_price_czk: number | null;
  p75_price_czk: number | null;
};

/**
 * Evaluate a listing against price_index_cache.
 * Resolves year/mileage buckets, queries cache (with fallback chain), then computes fair_price, deal_score, price_label.
 */
export async function evaluateListingPrice(
  listing: ListingForEvaluation,
  supabase?: SupabaseClient | null,
): Promise<PriceEvaluation> {
  const { model_key, year, mileage_km, price_czk } = listing;

  if (!model_key || typeof price_czk !== "number" || !Number.isFinite(price_czk)) {
    return {
      fair_price: null,
      deal_score: null,
      price_label: "NO DATA",
      median_price: null,
      p25: null,
      p75: null,
    };
  }

  const client = supabase ?? getSupabaseAdmin();
  const yearBucket = getYearBucket(year);
  const mileageBucket = getMileageBucket(mileage_km);
  const chain = getBucketFallbackChain(yearBucket, mileageBucket);

  let row: CacheRow | null = null;
  for (const bucket of chain) {
    const { data, error } = await client
      .from("price_index_cache")
      .select("median_price_czk, p25_price_czk, p75_price_czk")
      .eq("model_key", model_key)
      .eq("bucket", bucket)
      .maybeSingle();

    if (!error && data) {
      const med = data.median_price_czk;
      const p25 = data.p25_price_czk;
      const p75 = data.p75_price_czk;
      if (
        med != null &&
        Number.isFinite(med) &&
        p25 != null &&
        Number.isFinite(p25) &&
        p75 != null &&
        Number.isFinite(p75)
      ) {
        row = data as CacheRow;
        break;
      }
    }
  }

  if (!row || row.median_price_czk == null || row.p25_price_czk == null || row.p75_price_czk == null) {
    return {
      fair_price: null,
      deal_score: null,
      price_label: "NO DATA",
      median_price: null,
      p25: null,
      p75: null,
    };
  }

  const median_price = row.median_price_czk as number;
  const p25 = row.p25_price_czk as number;
  const p75 = row.p75_price_czk as number;

  const computed = computeEvaluation(price_czk, median_price, p25, p75);
  return {
    ...computed,
    median_price,
    p25,
    p75,
  };
}
