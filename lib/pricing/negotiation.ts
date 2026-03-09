export function computeNegotiation(params: {
  median_price_czk: number;
  p25_price_czk: number;
  p75_price_czk: number;
}) {
  const { median_price_czk, p25_price_czk, p75_price_czk } = params;

  const fair_low_czk = p25_price_czk;
  const fair_high_czk = p75_price_czk;

  const target_buy_czk = Math.round(
    fair_low_czk + 0.35 * (median_price_czk - fair_low_czk),
  );

  return {
    target_buy_czk,
    fair_low_czk,
    fair_high_czk,
  };
}

