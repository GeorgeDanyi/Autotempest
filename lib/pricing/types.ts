import type { DealLabel as DealScoreLabel } from "@/lib/pricing/calculateDealScore";

/** Rozpad vzorku podle zdroje (sauto, tipcars, případně other). Vždy platí total === sauto + tipcars + (other ?? 0). */
export type SampleSizeBySource = {
  sauto: number;
  tipcars: number;
  other?: number;
};

export type PriceApiResponse = {
  ok: boolean;
  model_key: string;
  requested_bucket?: string;
  resolved_bucket?: string;
  bucket?: string;
  bucket_used?: string;
  segment_mode?: "exact" | "fallback";
  sample_size: number | null;
  /** Celkový počet pozorování (shodný se sample_size, pro konzistenci). */
  sample_size_total?: number | null;
  /** Počet pozorování podle zdroje (sauto / tipcars). */
  sample_size_by_source?: SampleSizeBySource | null;
  /** Režim zdroje: all_sources (výchozí) nebo sauto_only. */
  source_mode?: "all_sources" | "sauto_only";
  confidence_score?: number;
  confidence_label?: string;
  data_quality_note?: string;
  median_price_czk: number | null;
  p25_price_czk: number | null;
  p75_price_czk: number | null;
  min_price_czk: number | null;
  max_price_czk: number | null;
  fallback_used?: boolean;
  requested_mileage_from?: number;
  requested_mileage_to?: number;
  applied_mileage_from?: number;
  applied_mileage_to?: number;
  input_price_czk: number | null;
  deal_score: number | null;
  deal_label: string;
  dealScore: number | null;
  dealLabel: DealScoreLabel;
  priceDeltaCzk: number | null;
  priceDeltaPct: number | null;
};

/** Single source of truth for /analyze dashboard – derived from /api/price response. */
export type SharedAnalysisResult = {
  model_key: string;
  requested_bucket: string;
  resolved_bucket: string;
  fallback_used: boolean;
  segment_mode?: "exact" | "fallback";
  requested_mileage_from?: number;
  requested_mileage_to?: number;
  applied_mileage_from?: number;
  applied_mileage_to?: number;
  sample_size: number | null;
  confidence_score: number | null;
  confidence_label: string | null;
  data_quality_note: string | null;
  median_price_czk: number | null;
  p25_price_czk: number | null;
  p75_price_czk: number | null;
  min_price_czk: number | null;
  max_price_czk: number | null;
};

export type DealListing = {
  brand: string | null;
  model: string | null;
  model_key: string | null;
  price_czk: number | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
  region: string | null;
  observed_at: string;
};

export type DealMarket = {
  median_price_czk: number | null;
  p25_price_czk: number | null;
  p75_price_czk: number | null;
  sample_size: number | null;
  min_price_czk: number | null;
  max_price_czk: number | null;
} | null;

export type DealNegotiation = {
  target_buy_czk: number;
  fair_low_czk: number;
  fair_high_czk: number;
} | null;

export type DealApiResponse = {
  ok: boolean;
  source: string;
  source_listing_id: string;
  bucket: string;
  listing: DealListing;
  market: DealMarket;
  negotiation: DealNegotiation;
  deal_score: number | null;
  deal_label: string;
};

export type PriceTrendsPoint = {
  observed_day?: string;
  computed_at?: string;
  observed_at?: string;
  median_price_czk: number | null;
  p25_price_czk?: number | null;
  p75_price_czk?: number | null;
  sample_size?: number | null;
};

export type PriceTrendsResponse = {
  ok: boolean;
  model_key: string;
  history: PriceTrendsPoint[];
};

