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

export type Verdict = {
  input_price_czk: number | null;
  deal_score: number | null;
  deal_label: string;
  confidence: {
    level: string;
    reason: string | null;
  };
};

export type PriceResponse = {
  ok: true;
  model_key: string;
  bucket: string;
  bucket_used: string;
  market: MarketStats;
  verdict: Verdict;
};

export type DealResponse = {
  ok: true;
  source: string;
  source_listing_id: string;
  bucket: string;
  bucket_used: string;
  listing: {
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
  market: MarketStats;
  negotiation: {
    target_buy_czk: number;
    fair_low_czk: number;
    fair_high_czk: number;
  } | null;
  verdict: Verdict;
};

