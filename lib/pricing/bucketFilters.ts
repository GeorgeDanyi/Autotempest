/**
 * Parse resolved_bucket string (format: year_*__engine_*__mileage_*) into DB filters.
 * Same semantics as lib/pricing/buckets and marketShape for consistency.
 */

export type BucketFilters = {
  yearFrom?: number;
  yearTo?: number;
  engineKey?: string | null;
  mileageMin?: number;
  mileageMax?: number;
};

const MILEAGE_RANGES: Record<string, [number, number]> = {
  mileage_0_50k: [0, 50_000],
  mileage_50_100k: [50_000, 100_000],
  mileage_100_150k: [100_000, 150_000],
  mileage_150_200k: [150_000, 200_000],
  mileage_200_250k: [200_000, 250_000],
  mileage_250k_plus: [250_000, 10_000_000],
};

export function parseBucketToFilters(bucket: string | null | undefined): BucketFilters {
  const out: BucketFilters = {};
  if (!bucket || bucket === "all") return out;

  const parts = bucket.split("__");
  for (const part of parts) {
    if (part.startsWith("year_")) {
      if (part === "unknown_year") continue;
      if (part === "year_2022_plus") {
        out.yearFrom = 2022;
        continue;
      }
      const match = part.match(/^year_(\d{4})_(\d{4})$/) ?? part.match(/^year_(\d{4})_plus$/);
      if (match) {
        out.yearFrom = parseInt(match[1], 10);
        out.yearTo = match[2] ? parseInt(match[2], 10) : undefined;
      }
      continue;
    }
    if (part.startsWith("engine_")) {
      const key = part.slice(7).trim();
      if (key) out.engineKey = key;
      continue;
    }
    if (part.startsWith("mileage_") && part !== "unknown_mileage") {
      const range = MILEAGE_RANGES[part];
      if (range) {
        out.mileageMin = range[0];
        out.mileageMax = range[1];
      }
    }
  }
  return out;
}
