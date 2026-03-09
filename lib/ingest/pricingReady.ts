/**
 * Kritéria použitelnosti observation pro pricing.
 * Pricing engine vyžaduje minimálně: model_key, price_czk, year, mileage_km.
 */

export type PricingReadyFields = {
  model_key: string | null;
  price_czk: number | null;
  year: number | null;
  mileage_km: number | null;
  fuel?: string | null;
  engine_key?: string | null;
};

/** Minimální pole pro výpočet ceny (required). */
const REQUIRED_KEYS: (keyof PricingReadyFields)[] = [
  "model_key",
  "price_czk",
  "year",
  "mileage_km",
];

function hasRequiredValue(
  obs: PricingReadyFields,
  key: keyof PricingReadyFields
): boolean {
  const v = obs[key];
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v) && v > 0;
  return false;
}

/**
 * Vrátí true, pokud má observation všechna povinná pole pro pricing.
 * Volitelná pole (fuel, engine_key) neovlivňují výsledek.
 */
export function isObservationPricingReady(obs: PricingReadyFields): boolean {
  for (const key of REQUIRED_KEYS) {
    if (!hasRequiredValue(obs, key)) return false;
  }
  return true;
}

/**
 * Počet chybějících required polí (0 = pricing ready).
 */
export function missingPricingRequiredCount(obs: PricingReadyFields): number {
  let n = 0;
  for (const key of REQUIRED_KEYS) {
    if (!hasRequiredValue(obs, key)) n += 1;
  }
  return n;
}
