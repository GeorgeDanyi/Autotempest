export type DealLabel = "top_deal" | "good" | "fair" | "overpriced" | "unknown";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * deal_score:
 *  + = levnější než trh
 *  0 = kolem mediánu
 *  - = dražší než trh
 *
 * Normalizace podle IQR (p75 - p25), aby to bylo stabilní.
 */
export function computeDealScore(params: {
  price_czk: number;
  median_price_czk: number;
  p25_price_czk: number;
  p75_price_czk: number;
}): number | null {
  const { price_czk, median_price_czk, p25_price_czk, p75_price_czk } = params;

  const iqr = p75_price_czk - p25_price_czk;
  if (!Number.isFinite(iqr) || iqr <= 0) return null;

  const raw = (median_price_czk - price_czk) / iqr;

  // omezíme extrémy (outliery, chyby v datech)
  return clamp(raw, -2, 2);
}

export function labelFromDealScore(score: number | null): DealLabel {
  if (score === null) return "unknown";

  if (score > 0.6) return "top_deal";
  if (score > 0.2) return "good";
  if (score >= -0.2) return "fair";
  return "overpriced";
}

