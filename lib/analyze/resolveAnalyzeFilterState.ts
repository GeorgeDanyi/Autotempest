/**
 * Jediný zdroj pravdy pro finální UI stav filtrů značka/model.
 * Bere parsed params (z URL) + filterOptions (z API) a vrací vždy finální render state:
 * brandValue, brandLabel, modelValue, modelLabel, brandOptions, modelOptions.
 * Když v URL je jen model=skoda_octavia, odvodí brand z modelKeyToBrand.
 */

import { normalizeBrandKey, formatBrandLabelFromKey } from "./normalizeBrandKey";

export type FilterOption = { value: string; label: string };

export type FilterOptionsData = {
  brands: Array<FilterOption>;
  brandKeyToLabel: Record<string, string>;
  modelsByBrand: Record<string, Array<FilterOption>>;
  modelKeyToBrand: Record<string, string>;
  modelKeyToLabel: Record<string, string>;
};

export type AnalyzeFilterParams = {
  brand: string | null;
  model: string | null;
};

export type ResolvedAnalyzeFilterState = {
  /** Hodnota pro ComboBox Značka (value). */
  brandValue: string | null;
  /** Label pro zobrazení značky (pro UI/chips). */
  brandLabel: string | null;
  /** Hodnota pro ComboBox Model (model_key). */
  modelValue: string | null;
  /** Label pro zobrazení modelu (např. "Octavia"). */
  modelLabel: string | null;
  /** Odvozená značka z model_key, pokud brand chyběl. */
  derivedBrand: string | null;
  /** Odvozený label modelu z model_key. */
  derivedModelLabel: string | null;
  /** Options pro dropdown Značka: { value, label }. */
  brandOptions: Array<{ value: string; label: string }>;
  /** Options pro dropdown Model (jen pro derivedBrand/vybranou značku). */
  modelOptions: Array<{ value: string; label: string }>;
};

function formatModelKeyAsLabel(modelKey: string): string {
  const parts = modelKey.split("_").filter(Boolean);
  if (parts.length <= 1) return modelKey;
  return parts
    .slice(1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function lookupBrandKey(modelKey: string | null, data: FilterOptionsData | null): string | null {
  if (!modelKey || !data?.modelKeyToBrand) return null;
  const key = modelKey.trim();
  return data.modelKeyToBrand[key] ?? data.modelKeyToBrand[key.toLowerCase()] ?? null;
}

function lookupModelLabel(modelKey: string | null, data: FilterOptionsData | null): string | null {
  if (!modelKey || !data?.modelKeyToLabel) return null;
  const key = modelKey.trim();
  return data.modelKeyToLabel[key] ?? data.modelKeyToLabel[key.toLowerCase()] ?? formatModelKeyAsLabel(modelKey);
}

/**
 * Vyřeší finální stav filtrů značka/model pro UI.
 * - brandValue = normalizovaný key (např. "skoda"); brandLabel = hezký label (např. "Škoda").
 * - modelValue = model_key; modelLabel = jen název modelu (Octavia).
 * - Pokud je v params jen model_key, odvodí derivedBrandKey z modelKeyToBrand.
 */
export function resolveAnalyzeFilterState(
  params: AnalyzeFilterParams,
  filterOptions: FilterOptionsData | null
): ResolvedAnalyzeFilterState {
  const inputBrand = params.brand?.trim() || null;
  const modelFromParams = params.model?.trim() || null;

  const derivedBrandKey =
    (inputBrand ? normalizeBrandKey(inputBrand) : null) ||
    lookupBrandKey(modelFromParams, filterOptions) ||
    null;

  const brandLabel =
    (derivedBrandKey && filterOptions?.brandKeyToLabel?.[derivedBrandKey]) ??
    (derivedBrandKey ? formatBrandLabelFromKey(derivedBrandKey) : null);

  const brandOptions: Array<FilterOption> = filterOptions?.brands ?? [];
  const modelOptions: Array<FilterOption> = derivedBrandKey
    ? (filterOptions?.modelsByBrand?.[derivedBrandKey] ?? [])
    : [];
  const modelIsValidForBrand =
    modelFromParams != null &&
    modelOptions.some((opt) => opt.value === modelFromParams);
  const finalModelValue = modelIsValidForBrand ? modelFromParams : null;
  const finalModelLabel = finalModelValue
    ? (lookupModelLabel(finalModelValue, filterOptions) ?? formatModelKeyAsLabel(finalModelValue))
    : null;

  if (process.env.NODE_ENV === "development") {
    const hasModelInUrl = Boolean(params.model);
    const mkb = filterOptions?.modelKeyToBrand ?? {};
    const mkl = filterOptions?.modelKeyToLabel ?? {};
    console.log("[resolveAnalyzeFilterState]", {
      "parsed.brand": inputBrand ?? "–",
      "parsed.model": modelFromParams ?? "–",
      "brandValue (final)": derivedBrandKey ?? "–",
      "brandLabel (final)": brandLabel ?? "–",
      "modelValue (final)": finalModelValue ?? "–",
      "modelLabel (final)": finalModelLabel ?? "–",
      "brandOptions.length": brandOptions.length,
      "modelOptions.length": modelOptions.length,
      "modelKeyToBrand[skoda_octavia]": hasModelInUrl ? (mkb["skoda_octavia"] ?? mkb["skoda_octavia"] ?? "–") : "(skip)",
      "modelKeyToLabel[skoda_octavia]": hasModelInUrl ? (mkl["skoda_octavia"] ?? "–") : "(skip)",
    });
  }

  return {
    brandValue: derivedBrandKey,
    brandLabel: brandLabel,
    modelValue: finalModelValue,
    modelLabel: finalModelLabel,
    derivedBrand: derivedBrandKey,
    derivedModelLabel: finalModelLabel,
    brandOptions,
    modelOptions,
  };
}
