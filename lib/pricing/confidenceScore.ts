/**
 * Confidence score and data quality for price analysis.
 * Combines sample size with fallback distance for a realistic 0–100 score.
 */

export type ConfidenceLabel =
  | "Velmi nízká"
  | "Nízká"
  | "Střední"
  | "Vysoká"
  | "Velmi vysoká";

export type ConfidenceResult = {
  confidence_score: number;
  confidence_label: ConfidenceLabel;
  data_quality_note: string;
};

// --- Sample size bands (base score 0–100) ---
const SAMPLE_BANDS = [
  { max: 2, baseScore: 10 },   // < 3  = velmi nízká
  { max: 9, baseScore: 35 },   // 3–9  = nízká
  { max: 24, baseScore: 60 },  // 10–24 = střední
  { max: 59, baseScore: 82 },  // 25–59 = vysoká
  { max: Infinity, baseScore: 95 }, // 60+ = velmi vysoká
] as const;

// --- Fallback penalty (subtracted from base) ---
const FALLBACK_PENALTY = {
  exact: 0,    // 0 steps
  one: 12,     // 1 level
  two: 20,     // 2 levels
  full: 28,    // 3+ or resolved === "all"
} as const;

// --- Score to label (after penalty applied) ---
function scoreToLabel(score: number): ConfidenceLabel {
  if (score < 20) return "Velmi nízká";
  if (score < 40) return "Nízká";
  if (score < 60) return "Střední";
  if (score < 80) return "Vysoká";
  return "Velmi vysoká";
}

/**
 * Base confidence score from sample size only (0–100).
 * Tune SAMPLE_BANDS to adjust.
 */
export function baseScoreFromSampleSize(sample_size: number | null): number {
  const n = sample_size == null || !Number.isFinite(sample_size) ? 0 : Math.max(0, Math.floor(sample_size));
  for (const band of SAMPLE_BANDS) {
    if (n <= band.max) return band.baseScore;
  }
  return SAMPLE_BANDS[SAMPLE_BANDS.length - 1].baseScore;
}

/**
 * How many fallback steps were used (0 = exact bucket).
 * fallbackChain is ordered from most to least specific; we use index of resolved.
 */
export function fallbackSteps(
  requested_bucket: string,
  resolved_bucket: string,
  fallbackChain: string[],
): number {
  if (requested_bucket === resolved_bucket) return 0;
  const resolvedIndex = fallbackChain.indexOf(resolved_bucket);
  const requestedIndex = fallbackChain.indexOf(requested_bucket);
  if (resolvedIndex < 0 || requestedIndex < 0) return resolved_bucket === "all" ? 4 : 2;
  return Math.min(4, resolvedIndex - requestedIndex);
}

/**
 * Penalty to subtract from base score (0 = no penalty).
 * Tune FALLBACK_PENALTY to adjust.
 */
export function fallbackPenalty(steps: number, resolved_bucket: string): number {
  if (steps <= 0) return FALLBACK_PENALTY.exact;
  if (resolved_bucket === "all") return FALLBACK_PENALTY.full;
  if (steps === 1) return FALLBACK_PENALTY.one;
  if (steps === 2) return FALLBACK_PENALTY.two;
  return FALLBACK_PENALTY.full;
}

/**
 * Short UI note explaining data quality (fallback / exact).
 */
export function dataQualityNote(
  fallback_used: boolean,
  resolved_bucket: string,
): string {
  if (!fallback_used) return "Data odpovídají zvolenému segmentu.";
  if (resolved_bucket === "all") return "Analýza vychází z celého trhu modelu.";
  return "Analýza vychází z širšího segmentu trhu.";
}

/**
 * Compute final confidence score, label and note.
 * Uses sample_size + fallback distance; easy to tune via SAMPLE_BANDS and FALLBACK_PENALTY.
 */
export function computeConfidenceScore(params: {
  sample_size: number | null;
  requested_bucket: string;
  resolved_bucket: string;
  fallback_used: boolean;
  fallback_chain: string[];
}): ConfidenceResult {
  const { sample_size, requested_bucket, resolved_bucket, fallback_used, fallback_chain } = params;

  const base = baseScoreFromSampleSize(sample_size);
  const steps = fallbackSteps(requested_bucket, resolved_bucket, fallback_chain);
  const penalty = fallbackPenalty(steps, resolved_bucket);
  const raw = base - penalty;
  const confidence_score = Math.round(Math.max(0, Math.min(100, raw)));
  const confidence_label = scoreToLabel(confidence_score);
  const data_quality_note = dataQualityNote(fallback_used, resolved_bucket);

  return {
    confidence_score,
    confidence_label,
    data_quality_note,
  };
}
