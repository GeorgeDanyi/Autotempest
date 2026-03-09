/**
 * Vrací možnosti pro filtry analýzy (značka, model) z reálných dat v market_observations.
 * Produkční režim: bez beta whitelistu a bez featured výjimek.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeBrandKey, formatBrandLabelFromKey } from "@/lib/analyze/normalizeBrandKey";
import { getBrandKeyFromModelKey } from "@/lib/cars/getBrandKeyFromModelKey";

export const runtime = "nodejs";

const MAX_ROWS = 20_000;

function getEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon };
}

function formatModelKeyAsLabel(modelKey: string): string {
  const parts = modelKey.split("_").filter(Boolean);
  if (parts.length <= 1) return modelKey;
  return parts
    .slice(1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

/** Jediný tvar pro options v celé aplikaci (API, homepage, /analyze, resolver). */
export type FilterOption = { value: string; label: string };

export type FilterOptionsResponse =
  | {
      ok: true;
      brands: Array<FilterOption>;
      brandKeyToLabel: Record<string, string>;
      modelsByBrand: Record<string, Array<FilterOption>>;
      modelKeyToBrand: Record<string, string>;
      modelKeyToLabel: Record<string, string>;
    }
  | { ok: false; error?: string };

export async function GET(): Promise<NextResponse<FilterOptionsResponse>> {
  const { url, anon } = getEnv();
  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  try {
    const { data, error: listError } = await supabase
      .from("market_observations")
      .select("brand, model_key, model")
      .not("brand", "is", null)
      .not("model_key", "is", null)
      .neq("model_key", "")
      .order("brand", { ascending: true })
      .order("model_key", { ascending: true })
      .limit(MAX_ROWS);

    if (listError) {
      return NextResponse.json(
        { ok: false, error: listError.message },
        { status: 500 }
      );
    }

    const list = (data ?? []) as Array<{
      brand: string | null;
      model_key: string | null;
      model: string | null;
    }>;

    const modelKeyBrandVotes = new Map<string, Map<string, number>>();
    const modelKeyToLabel: Record<string, string> = {};

    for (const r of list) {
      const brandRaw = r.brand?.trim() ?? null;
      const modelKey = r.model_key?.trim() ?? null;
      if (!brandRaw || !modelKey) continue;

      const brandKey = normalizeBrandKey(brandRaw);
      if (!brandKey) continue;
      const label = formatModelKeyAsLabel(modelKey);
      modelKeyToLabel[modelKey] = modelKeyToLabel[modelKey] ?? label;
      if (!modelKeyBrandVotes.has(modelKey)) modelKeyBrandVotes.set(modelKey, new Map());
      const votes = modelKeyBrandVotes.get(modelKey)!;
      votes.set(brandKey, (votes.get(brandKey) ?? 0) + 1);
    }

    const canonicalModelKeyToBrand: Record<string, string> = {};
    for (const [modelKey, votes] of modelKeyBrandVotes.entries()) {
      const brandFromKey = getBrandKeyFromModelKey(modelKey);
      if (brandFromKey) {
        canonicalModelKeyToBrand[modelKey] = brandFromKey;
        continue;
      }
      const sortedVotes = Array.from(votes.entries())
        .filter(([brand]) => brand.trim() !== "" && brand !== "unknown")
        .sort((a, b) => b[1] - a[1]);
      const majorityBrand = sortedVotes[0]?.[0] ?? null;
      if (majorityBrand) canonicalModelKeyToBrand[modelKey] = majorityBrand;
    }

    const modelKeyToBrand: Record<string, string> = {};
    for (const [modelKey, brandKey] of Object.entries(canonicalModelKeyToBrand)) {
      if (!brandKey) continue;
      modelKeyToBrand[modelKey] = brandKey;
    }
    const finalModelKeys = Object.keys(modelKeyToBrand);
    const finalBrandKeys = Array.from(
      new Set(finalModelKeys.map((k) => modelKeyToBrand[k]).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "cs"));

    const brands: Array<FilterOption> = finalBrandKeys.map((brandKey) => ({
      value: brandKey,
      label: formatBrandLabelFromKey(brandKey),
    }));
    const brandKeyToLabel: Record<string, string> = Object.fromEntries(
      finalBrandKeys.map((k) => [k, formatBrandLabelFromKey(k)])
    );
    const modelsByBrand: Record<string, Array<FilterOption>> = {};
    const filteredModelKeyToBrand: Record<string, string> = {};
    const filteredModelKeyToLabel: Record<string, string> = {};

    for (const brandKey of finalBrandKeys) {
      const modelKeysForBrand = finalModelKeys.filter((mk) => modelKeyToBrand[mk] === brandKey);
      const modelsSorted = modelKeysForBrand
        .map((mk) => ({
          value: mk,
          label: modelKeyToLabel[mk] ?? formatModelKeyAsLabel(mk),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "cs"));
      if (modelsSorted.length === 0) continue;
      modelsByBrand[brandKey] = modelsSorted;
      for (const { value, label } of modelsSorted) {
        filteredModelKeyToBrand[value] = brandKey;
        filteredModelKeyToLabel[value] = label;
      }
    }

    const payload: FilterOptionsResponse = {
      ok: true,
      brands,
      brandKeyToLabel,
      modelsByBrand,
      modelKeyToBrand: filteredModelKeyToBrand,
      modelKeyToLabel: filteredModelKeyToLabel,
    };

    if (process.env.NODE_ENV === "development") {
      const skodaOctavia = "skoda_octavia";
      console.log("[api/analyze/filter-options] response shape:", {
        discovered_model_keys_count: Object.keys(canonicalModelKeyToBrand).length,
        discovered_model_keys_sample: Object.keys(canonicalModelKeyToBrand).slice(0, 20),
        final_model_keys_count: finalModelKeys.length,
        final_model_keys_sample: finalModelKeys.slice(0, 20),
        final_modelKeyToBrand: payload.modelKeyToBrand,
        final_brands: payload.brands,
        brandsLength: payload.brands.length,
        brandsSample: payload.brands.slice(0, 3),
        modelKeyToBrand_skoda_octavia: payload.modelKeyToBrand[skodaOctavia],
        modelKeyToLabel_skoda_octavia: payload.modelKeyToLabel[skodaOctavia],
        modelsByBrand_skoda_length: payload.modelsByBrand["skoda"]?.length ?? "N/A",
      });
    }

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
