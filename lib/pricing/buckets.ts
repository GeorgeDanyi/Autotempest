// ---------------------------------------------------------------------------
// Year buckets (bands)
// ---------------------------------------------------------------------------

export type YearBucket =
  | "year_2008_2011"
  | "year_2012_2015"
  | "year_2016_2018"
  | "year_2019_2021"
  | "year_2022_plus"
  | "unknown_year";

/** @deprecated Use YearBucket for new code; kept for backward compatibility. */
export type Bucket = YearBucket | "all";

export const ALL_YEAR_BUCKETS: readonly YearBucket[] = [
  "year_2008_2011",
  "year_2012_2015",
  "year_2016_2018",
  "year_2019_2021",
  "year_2022_plus",
  "unknown_year",
];

export function bucketForYear(year: number | null | undefined): YearBucket {
  if (year == null || !Number.isFinite(year)) return "unknown_year";
  const y = year as number;
  if (y >= 2022) return "year_2022_plus";
  if (y >= 2019) return "year_2019_2021";
  if (y >= 2016) return "year_2016_2018";
  if (y >= 2012) return "year_2012_2015";
  if (y >= 2008) return "year_2008_2011";
  return "unknown_year";
}

// ---------------------------------------------------------------------------
// Mileage buckets (delegate to marketShape for single source of truth)
// ---------------------------------------------------------------------------

import {
  getMileageBucket,
  getMileageBucketFromInterval,
  type MileageBucketLabel,
} from "@/lib/pricing/marketShape";

export type MileageBucket = MileageBucketLabel;
export {
  getMileageBucket as bucketForMileage,
  getMileageBucketFromInterval,
  ALL_MILEAGE_BUCKETS,
} from "@/lib/pricing/marketShape";

// ---------------------------------------------------------------------------
// Engine buckets (from parser engine_key)
// ---------------------------------------------------------------------------

export const ALL_ENGINE_BUCKETS: readonly string[] = [
  "engine_1_6_tdi",
  "engine_1_9_tdi",
  "engine_2_0_tdi",
  "engine_2_0_tdi_4x4",
  "engine_1_0_tsi",
  "engine_1_2_tsi",
  "engine_1_4_tsi",
  "engine_1_5_tsi",
  "engine_1_8_tsi",
  "engine_2_0_tsi",
  "engine_rs",
  "engine_dsg",
  "engine_lpg",
  "engine_hybrid",
  "engine_ev",
  "engine_unknown",
];

export function engineBucketFromKey(engine_key: string | null | undefined): string | null {
  if (engine_key == null || engine_key === "") return null;
  const key = String(engine_key).trim().toLowerCase();
  if (!key) return null;
  return `engine_${key}` as string;
}

// ---------------------------------------------------------------------------
// Compose bucket strings (order: year, engine, mileage)
// ---------------------------------------------------------------------------

export function composeBucket(params: {
  yearBucket: YearBucket;
  mileageBucket?: MileageBucket | null;
  engineBucket?: string | null;
}): string {
  const { yearBucket, mileageBucket, engineBucket } = params;
  const parts: string[] = [yearBucket];
  if (engineBucket) parts.push(engineBucket);
  if (mileageBucket && mileageBucket !== "unknown_mileage") parts.push(mileageBucket);
  return parts.join("__");
}

/** Build a single bucket string from components (order: year, engine, mileage). */
export function buildBucketString(params: {
  yearBucket: YearBucket;
  mileageBucket?: MileageBucket | null;
  engineBucket?: string | null;
}): string {
  return composeBucket(params);
}

// ---------------------------------------------------------------------------
// Best bucket + fallback chain
// ---------------------------------------------------------------------------

export type BestBucketResult = {
  yearBucket: YearBucket;
  mileageBucket: MileageBucket;
  engineBucket: string | null;
  bestBucket: string;
  fallbackChain: string[];
  /** True when mileage came from exact interval match (mileageFrom+mileageTo), false when from single bound or no match. */
  exactMileageMatch: boolean;
};

/**
 * Build the best bucket and fallback chain from optional year, mileage, and engine_key.
 * When both mileageFrom and mileageTo are set, uses exact interval bucket if it matches;
 * otherwise uses upper bound (mileageTo) for bucket selection (fallback).
 * Prefers year+engine+mileage when all present; otherwise year+engine, year+mileage, year, or "all".
 */
export function buildBestBucket(params: {
  year?: number | null;
  mileage_km?: number | null;
  mileageFrom?: number | null;
  mileageTo?: number | null;
  engine_key?: string | null;
}): BestBucketResult {
  const { year, mileage_km, mileageFrom, mileageTo, engine_key } = params;
  const yearBucket = bucketForYear(year);
  const hasExplicitInterval =
    mileageFrom != null && mileageTo != null && Number.isFinite(mileageFrom) && Number.isFinite(mileageTo);
  const intervalBucket = hasExplicitInterval ? getMileageBucketFromInterval(mileageFrom, mileageTo) : null;
  const mileageBucket =
    hasExplicitInterval && intervalBucket != null
      ? intervalBucket
      : getMileageBucket(mileage_km ?? mileageTo ?? mileageFrom);
  const exactMileageMatch = hasExplicitInterval && intervalBucket != null && intervalBucket === mileageBucket;

  const engineBucket = engineBucketFromKey(engine_key);

  const hasYear = yearBucket !== "unknown_year";
  const hasMileage = mileageBucket !== "unknown_mileage";
  const hasEngine = engineBucket != null && engineBucket !== "";

  const chain: string[] = [];

  if (hasYear && hasEngine && hasMileage) {
    chain.push(buildBucketString({ yearBucket, engineBucket, mileageBucket }));
  }
  if (hasYear && hasEngine) {
    chain.push(buildBucketString({ yearBucket, engineBucket }));
  }
  if (hasYear && hasMileage) {
    chain.push(buildBucketString({ yearBucket, mileageBucket }));
  }
  if (hasYear) {
    chain.push(yearBucket);
  }
  chain.push("all");

  const bestBucket = chain.length > 1 ? chain[0] : "all";

  return {
    yearBucket,
    mileageBucket,
    engineBucket,
    bestBucket,
    fallbackChain: chain,
    exactMileageMatch,
  };
}
