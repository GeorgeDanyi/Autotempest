export type DealLabel = "top_deal" | "good" | "fair" | "overpriced" | "unknown";

export function computeDeal(params: {
  price_czk: number | null;
  p25_price_czk: number | null;
  median_price_czk: number | null;
  p75_price_czk: number | null;
  sample_size: number | null;
}): { deal_score: number | null; deal_label: DealLabel } {
  const { price_czk, p25_price_czk, median_price_czk, p75_price_czk, sample_size } = params;

  // musíme mít všechna čísla k dispozici
  if (
    price_czk == null ||
    p25_price_czk == null ||
    median_price_czk == null ||
    p75_price_czk == null ||
    sample_size == null
  ) {
    return { deal_score: null, deal_label: "unknown" };
  }

  // pokud máme málo dat, neštítkujeme
  if (sample_size < 5) {
    return { deal_score: null, deal_label: "unknown" };
  }

  // škála: 1.0 = p25, 0.0 = median, -1.0 = p75
  const lowerSpan = Math.max(1, median_price_czk - p25_price_czk);
  const upperSpan = Math.max(1, p75_price_czk - median_price_czk);

  let score: number;
  if (price_czk <= median_price_czk) {
    score = (median_price_czk - price_czk) / lowerSpan; // 0..+
  } else {
    score = -((price_czk - median_price_czk) / upperSpan); // 0..-
  }

  // cap ať se to nezblázní u outlierů
  score = Math.max(-2, Math.min(2, score));

  let label: DealLabel = "fair";
  if (score >= 1.0) label = "top_deal";
  else if (score >= 0.4) label = "good";
  else if (score > -0.4) label = "fair";
  else label = "overpriced";

  return { deal_score: score, deal_label: label };
}
