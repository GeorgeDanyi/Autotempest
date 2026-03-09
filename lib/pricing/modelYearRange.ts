/**
 * Model–year sanity check: pro každý model_key z market_observations
 * zjistíme minimální a maximální observed year. Nevalidní kombinace (např.
 * skoda_citigo + year=2002) nesmí dostat standardní pricing ani fallback na "all".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ModelYearRange = {
  minYear: number;
  maxYear: number;
};

/**
 * Načte z market_observations min a max rok pro daný model_key.
 * Vrací null, pokud pro model nejsou žádná pozorování (pak validaci přeskočíme).
 */
export async function getModelYearRange(
  supabase: SupabaseClient,
  model_key: string
): Promise<ModelYearRange | null> {
  const { data: minRow, error: minErr } = await supabase
    .from("market_observations")
    .select("year")
    .eq("model_key", model_key)
    .not("year", "is", null)
    .order("year", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (minErr || minRow == null) return null;

  const { data: maxRow, error: maxErr } = await supabase
    .from("market_observations")
    .select("year")
    .eq("model_key", model_key)
    .not("year", "is", null)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr || maxRow == null) return null;

  const minYear = typeof (minRow as { year: number }).year === "number" ? (minRow as { year: number }).year : null;
  const maxYear = typeof (maxRow as { year: number }).year === "number" ? (maxRow as { year: number }).year : null;
  if (minYear == null || maxYear == null || !Number.isFinite(minYear) || !Number.isFinite(maxYear)) return null;

  return { minYear, maxYear };
}

export function isYearValid(
  year: number | null | undefined,
  range: ModelYearRange | null
): boolean {
  if (range == null || year == null || !Number.isFinite(year)) return true;
  return year >= range.minYear && year <= range.maxYear;
}

/**
 * Platnost rozsahu let: požadovaný interval [yearFrom, yearTo] musí mít průnik
 * s observed [minYear, maxYear]. Prázdný interval (oba null) = nevalidujeme.
 */
export function isYearRangeValid(
  yearFrom: number | null | undefined,
  yearTo: number | null | undefined,
  range: ModelYearRange | null
): boolean {
  if (range == null) return true;
  const from = yearFrom != null && Number.isFinite(yearFrom) ? yearFrom : null;
  const to = yearTo != null && Number.isFinite(yearTo) ? yearTo : null;
  if (from == null && to == null) return true;
  const reqMin = from ?? to ?? 0;
  const reqMax = to ?? from ?? 9999;
  if (reqMax < range.minYear || reqMin > range.maxYear) return false;
  return true;
}
