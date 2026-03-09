/**
 * Model–brand sanity check: ověření, že model_key patří pod zvolenou značku.
 * Primární source of truth je canonical brand odvozený přímo z model_key.
 * Fallback (jen pro legacy keys) je majority vote z market_observations.
 * Oba klíče se porovnávají v normalizovaném tvaru.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import { getBrandKeyFromModelKey } from "@/lib/cars/getBrandKeyFromModelKey";

/**
 * Vrátí očekávaný (normalizovaný) brand key pro daný model_key.
 * Primárně z canonical parseru model_key, fallback z DB.
 */
export async function getExpectedBrandForModel(
  supabase: SupabaseClient,
  model_key: string
): Promise<string | null> {
  const canonical = getBrandKeyFromModelKey(model_key);
  if (canonical) return canonical;

  // Fallback only for non-canonical/legacy model_key values.
  const { data, error } = await supabase
    .from("market_observations")
    .select("brand")
    .eq("model_key", model_key)
    .not("brand", "is", null)
    .limit(500);

  if (error || data == null || data.length === 0) return null;

  const votes = new Map<string, number>();
  for (const row of data as Array<{ brand: string | null }>) {
    const key = normalizeBrandKey(row.brand);
    if (!key || key === "unknown") continue;
    votes.set(key, (votes.get(key) ?? 0) + 1);
  }

  const sorted = Array.from(votes.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

/**
 * Ověří, zda zadaná kombinace model_key + brand_key je validní.
 * Oba vstupy musí být v normalizovaném tvaru; expected_brand získáte z getExpectedBrandForModel.
 * Vrací true, pokud requested_brand je null/empty (nevalidujeme) nebo se shoduje s expected_brand.
 */
export function isModelBrandValid(
  expectedBrand: string | null,
  requestedBrandKey: string | null | undefined
): boolean {
  if (requestedBrandKey == null || requestedBrandKey.trim() === "") return true;
  if (expectedBrand == null) return true;
  const requested = normalizeBrandKey(requestedBrandKey);
  return requested === expectedBrand;
}
