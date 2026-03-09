/** Mileage bucket labels for price index (0–50k, 50–100k, …, 250k+). */
export type MileageBucketLabel =
  | "mileage_0_50k"
  | "mileage_50_100k"
  | "mileage_100_150k"
  | "mileage_150_200k"
  | "mileage_200_250k"
  | "mileage_250k_plus"
  | "unknown_mileage";

export const ALL_MILEAGE_BUCKETS: readonly MileageBucketLabel[] = [
  "mileage_0_50k",
  "mileage_50_100k",
  "mileage_100_150k",
  "mileage_150_200k",
  "mileage_200_250k",
  "mileage_250k_plus",
];

/** Canonical ranges for each mileage bucket [min, max) in km. mileage_250k_plus is [250_000, +inf). */
export const MILEAGE_BUCKET_RANGES: Record<MileageBucketLabel, [number, number]> = {
  mileage_0_50k: [0, 50_000],
  mileage_50_100k: [50_000, 100_000],
  mileage_100_150k: [100_000, 150_000],
  mileage_150_200k: [150_000, 200_000],
  mileage_200_250k: [200_000, 250_000],
  mileage_250k_plus: [250_000, 10_000_000],
  unknown_mileage: [0, 0],
};

/**
 * Return mileage bucket for price index. Improves precision for high-mileage vehicles.
 * Uses upper bound: single mileage_km is mapped to the bucket that contains it.
 */
export function getMileageBucket(
  mileage_km: number | null | undefined,
): MileageBucketLabel {
  if (mileage_km == null || !Number.isFinite(mileage_km)) return "unknown_mileage";
  const km = mileage_km as number;
  if (km < 50_000) return "mileage_0_50k";
  if (km < 100_000) return "mileage_50_100k";
  if (km < 150_000) return "mileage_100_150k";
  if (km < 200_000) return "mileage_150_200k";
  if (km < 250_000) return "mileage_200_250k";
  return "mileage_250k_plus";
}

/**
 * Return mileage bucket when both bounds are set, if the interval exactly matches a bucket.
 * Otherwise returns null (caller should treat as fallback / use single-bound logic).
 */
export function getMileageBucketFromInterval(
  from_km: number | null | undefined,
  to_km: number | null | undefined,
): MileageBucketLabel | null {
  if (from_km == null || to_km == null || !Number.isFinite(from_km) || !Number.isFinite(to_km) || from_km > to_km)
    return null;
  const from = from_km as number;
  const to = to_km as number;
  for (const [label, [min, max]] of Object.entries(MILEAGE_BUCKET_RANGES)) {
    if (label === "unknown_mileage") continue;
    if (from !== min) continue;
    if (label === "mileage_250k_plus") return to >= min ? "mileage_250k_plus" : null;
    if (to === max) return label as MileageBucketLabel;
  }
  return null;
}

export type MarketStats = {
  model_key: string | null;
  bucket: string;
  sample_size: number | null;
  median_price_czk: number | null;
  p25_price_czk: number | null;
  p75_price_czk: number | null;
  min_price_czk: number | null;
  max_price_czk: number | null;
};

export function buildMarketStats(input: {
  model_key: string | null;
  bucket: string;
  row:
    | {
        sample_size: number | null;
        median_price_czk: number | null;
        p25_price_czk: number | null;
        p75_price_czk: number | null;
        min_price_czk: number | null;
        max_price_czk: number | null;
      }
    | null;
}): MarketStats {
  const { model_key, bucket, row } = input;

  if (!row) {
    return {
      model_key,
      bucket,
      sample_size: null,
      median_price_czk: null,
      p25_price_czk: null,
      p75_price_czk: null,
      min_price_czk: null,
      max_price_czk: null,
    };
  }

  return {
    model_key,
    bucket,
    sample_size: row.sample_size,
    median_price_czk: row.median_price_czk,
    p25_price_czk: row.p25_price_czk,
    p75_price_czk: row.p75_price_czk,
    min_price_czk: row.min_price_czk,
    max_price_czk: row.max_price_czk,
  };
}

