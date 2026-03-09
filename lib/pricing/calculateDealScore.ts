export type DealLabel =
  | "GREAT_DEAL"
  | "GOOD_DEAL"
  | "FAIR"
  | "OVERPRICED"
  | "VERY_OVERPRICED"
  | "UNKNOWN";

export type DealScoreResult = {
  dealScore: number | null;
  dealLabel: DealLabel;
  priceDeltaCzk: number | null;
  priceDeltaPct: number | null;
};

export function calculateDealScore(params: {
  inputPriceCzk: number | null | undefined;
  marketMedianPriceCzk: number | null | undefined;
}): DealScoreResult {
  const { inputPriceCzk, marketMedianPriceCzk } = params;

  const input =
    inputPriceCzk != null && Number.isFinite(inputPriceCzk) ? inputPriceCzk : null;
  const median =
    marketMedianPriceCzk != null && Number.isFinite(marketMedianPriceCzk)
      ? marketMedianPriceCzk
      : null;

  if (input == null || median == null || input <= 0 || median <= 0) {
    return {
      dealScore: null,
      dealLabel: "UNKNOWN",
      priceDeltaCzk: null,
      priceDeltaPct: null,
    };
  }

  const priceDeltaCzk = input - median;
  const priceDeltaPct = (priceDeltaCzk / median) * 100;

  let dealLabel: DealLabel;
  if (priceDeltaPct <= -12) {
    dealLabel = "GREAT_DEAL";
  } else if (priceDeltaPct <= -6) {
    dealLabel = "GOOD_DEAL";
  } else if (priceDeltaPct < 6) {
    dealLabel = "FAIR";
  } else if (priceDeltaPct < 12) {
    dealLabel = "OVERPRICED";
  } else {
    dealLabel = "VERY_OVERPRICED";
  }

  const rawScore = 60 + -priceDeltaPct * 2.5;
  const dealScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    dealScore,
    dealLabel,
    priceDeltaCzk,
    priceDeltaPct,
  };
}

// Examples:
//
// input 360000, median 420000
//   priceDeltaCzk = -60000
//   priceDeltaPct ≈ -14.29
//   dealLabel = "GREAT_DEAL"
//   rawScore ≈ 95.7 -> dealScore = 96
//
// input 400000, median 420000
//   priceDeltaCzk = -20000
//   priceDeltaPct ≈ -4.76
//   dealLabel = "FAIR" (between -6% and +6%)
//
// input 420000, median 420000
//   priceDeltaCzk = 0
//   priceDeltaPct = 0
//   dealLabel = "FAIR"
//   dealScore = 60
//
// input 470000, median 420000
//   priceDeltaCzk = 50000
//   priceDeltaPct ≈ 11.90
//   dealLabel = "OVERPRICED"
//
// input 520000, median 420000
//   priceDeltaCzk = 100000
//   priceDeltaPct ≈ 23.81
//   dealLabel = "VERY_OVERPRICED"

