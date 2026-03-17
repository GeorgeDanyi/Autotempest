export const SAUTO_PRICE_BUCKETS = [
  { od: 0, do: 100_000 },
  { od: 100_000, do: 200_000 },
  { od: 200_000, do: 300_000 },
  { od: 300_000, do: 500_000 },
  { od: 500_000, do: 800_000 },
  { od: 800_000, do: 1_500_000 },
  { od: 1_500_000, do: 99_999_999 },
] as const;

export type PriceBucket = (typeof SAUTO_PRICE_BUCKETS)[number];

export const SAUTO_YEAR_BUCKETS = [
  { od: 2000, do: 2010 },
  { od: 2010, do: 2015 },
  { od: 2015, do: 2019 },
  { od: 2019, do: 2022 },
  { od: 2022, do: 2030 },
] as const;

export type YearBucket = (typeof SAUTO_YEAR_BUCKETS)[number];
