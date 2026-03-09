/**
 * Validace model_key a model při ingestu – detekce chybných splitů (brand = Land Rover, model = Rover, model_key = land_rover).
 */

import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import {
  isBrandOnlyOrGenericModelKey,
} from "@/lib/cars/normalizeModel";
import { isModelLikelyBrandSuffix } from "@/lib/cars/multiWordBrands";

export type ModelKeyValidation = {
  invalid: boolean;
  reason?: "model_key_equals_brand_key" | "model_key_brand_only" | "model_likely_brand_suffix";
};

/**
 * Zkontroluje, zda kombinace brand/model/model_key vypadá jako invalid parse.
 * Při invalid loguje warning a vrátí { invalid: true, reason }.
 */
export function validateModelKey(
  brandDisplay: string | null | undefined,
  model: string | null | undefined,
  model_key: string | null | undefined,
  options?: { logWarnings?: boolean }
): ModelKeyValidation {
  const log = options?.logWarnings !== false;
  if (!model_key) return { invalid: false };

  const brandKey = normalizeBrandKey(brandDisplay || "");
  const key = String(model_key).trim().toLowerCase();

  if (brandKey && key === brandKey) {
    if (log) {
      console.warn(
        `[ingest][model_key] model_key equals brand_key: brand="${brandDisplay}" model_key="${model_key}" (model="${model ?? ""}")`
      );
    }
    return { invalid: true, reason: "model_key_equals_brand_key" };
  }

  if (isBrandOnlyOrGenericModelKey(model_key)) {
    if (log) {
      console.warn(
        `[ingest][model_key] model_key is brand-only or generic: brand="${brandDisplay}" model="${model ?? ""}" model_key="${model_key}"`
      );
    }
    return { invalid: true, reason: "model_key_brand_only" };
  }

  if (isModelLikelyBrandSuffix(brandDisplay, model)) {
    if (log) {
      console.warn(
        `[ingest][model_key] model looks like brand suffix (invalid parse): brand="${brandDisplay}" model="${model ?? ""}" model_key="${model_key}"`
      );
    }
    return { invalid: true, reason: "model_likely_brand_suffix" };
  }

  return { invalid: false };
}
