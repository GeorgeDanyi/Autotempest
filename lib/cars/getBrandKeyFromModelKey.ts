import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";

/**
 * Multi-word brand keys that can prefix model_key.
 * Example: mercedes_benz_gle -> mercedes_benz
 */
const MULTI_WORD_BRAND_KEYS = [
  "mercedes_benz",
  "land_rover",
  "alfa_romeo",
] as const;

/**
 * Derive canonical brand key directly from canonical model_key.
 * Returns null when model_key is empty/generic or cannot be parsed safely.
 */
export function getBrandKeyFromModelKey(modelKey: string | null | undefined): string | null {
  const key = String(modelKey ?? "").trim().toLowerCase();
  if (!key) return null;
  if (key === "unknown") return null;

  for (const brandKey of MULTI_WORD_BRAND_KEYS) {
    if (key === brandKey || key.startsWith(`${brandKey}_`)) return brandKey;
  }

  // We only trust single-word brand prefix when model_key contains at least brand + model part.
  if (!key.includes("_")) return null;
  const first = key.split("_")[0] ?? "";
  const normalized = normalizeBrandKey(first);
  if (!normalized || normalized === "unknown") return null;
  return normalized;
}

