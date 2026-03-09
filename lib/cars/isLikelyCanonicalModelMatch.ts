import { MODEL_ALIASES } from "@/lib/cars/modelAliases";
import { normalizeModelKey } from "@/lib/cars/normalizeModel";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";

function normalizeAscii(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitModelKey(targetModelKey: string, brandKey: string): string | null {
  const p = `${brandKey}_`;
  if (!targetModelKey.startsWith(p)) return null;
  return targetModelKey.slice(p.length) || null;
}

/**
 * Konzervativní guard pro model-specific override:
 * - brand musí sedět
 * - listing musí vypadat jako cílový model (normalizace nebo alias/model slug v model/title)
 */
export function isLikelyCanonicalModelMatch(params: {
  requestedBrand: string;
  targetModelKey: string;
  observationBrand: string | null | undefined;
  rawModel: string | null | undefined;
  title: string | null | undefined;
  normalizedModelKey?: string | null | undefined;
}): boolean {
  const {
    requestedBrand,
    targetModelKey,
    observationBrand,
    rawModel,
    title,
    normalizedModelKey,
  } = params;

  const requestedBrandKey = normalizeBrandKey(requestedBrand);
  const observationBrandKey = normalizeBrandKey(observationBrand);
  if (!requestedBrandKey || !observationBrandKey) return false;
  if (requestedBrandKey !== observationBrandKey) return false;

  const targetModelSlug = splitModelKey(targetModelKey, requestedBrandKey);
  if (!targetModelSlug) return false;

  if (
    normalizedModelKey != null &&
    normalizedModelKey.trim().toLowerCase() === targetModelKey.trim().toLowerCase()
  ) {
    return true;
  }

  const normByModel = normalizeModelKey({
    brand: observationBrand,
    model: rawModel,
    trim: title,
  });
  if (normByModel != null && normByModel.trim().toLowerCase() === targetModelKey.trim().toLowerCase()) {
    return true;
  }

  const textNorm = normalizeAscii([rawModel, title].filter(Boolean).join(" "));
  if (!textNorm) return false;

  const aliases = MODEL_ALIASES[requestedBrandKey]?.[targetModelSlug] ?? [];
  for (const alias of aliases) {
    const aliasNorm = normalizeAscii(alias);
    if (!aliasNorm) continue;
    if (aliasNorm.includes(" ")) {
      if (textNorm.includes(aliasNorm)) return true;
      continue;
    }
    const tokens = new Set(textNorm.split(" ").filter(Boolean));
    if (tokens.has(aliasNorm)) return true;
  }

  const slugAsText = targetModelSlug.replace(/_/g, " ");
  if (slugAsText && textNorm.includes(slugAsText)) return true;

  return false;
}

