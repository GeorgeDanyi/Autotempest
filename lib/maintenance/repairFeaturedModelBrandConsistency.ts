import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import { normalizeModelKey, isBrandOnlyOrGenericModelKey } from "@/lib/cars/normalizeModel";
import { buildModelKey } from "@/lib/ingest/textNormalize";

type Row = {
  id: number;
  brand: string | null;
  model: string | null;
  model_key: string | null;
  title: string | null;
};

type MismatchGroup = {
  model_key: string;
  canonical_brand: string;
  wrong_brand: string;
  count: number;
  sample_ids: number[];
};

export type RepairFeaturedModelBrandConsistencyResult = {
  scanned: number;
  repaired: number;
  unchanged: number;
  mismatches: MismatchGroup[];
  by_old_model_key: Record<string, number>;
  by_new_model_key: Record<string, number>;
};

const FEATURED_MODEL_TO_BRAND: Record<string, string> = {
  volkswagen_passat: "volkswagen",
  volkswagen_golf: "volkswagen",
  skoda_superb: "skoda",
  skoda_fabia: "skoda",
};
const FEATURED_MODEL_KEYS = Object.keys(FEATURED_MODEL_TO_BRAND);
const BATCH_SIZE = 500;

function asKey(v: string | null | undefined, fallback = "(null)"): string {
  const t = v?.trim();
  return t && t.length > 0 ? t : fallback;
}

function fallbackUnknownModelKey(brandRaw: string | null | undefined): string {
  const brandKey = normalizeBrandKey(brandRaw);
  const safeBrand = brandKey && brandKey.length > 0 ? brandKey : "unknown";
  return buildModelKey(safeBrand, "unknown");
}

function computeRepairedModelKey(row: Row): string {
  const normalized = normalizeModelKey({
    brand: row.brand,
    model: row.model,
    trim: row.title,
  });
  if (normalized != null && normalized.trim() !== "" && !isBrandOnlyOrGenericModelKey(normalized)) {
    return normalized;
  }
  return fallbackUnknownModelKey(row.brand);
}

export async function repairFeaturedModelBrandConsistency(
  supabase: SupabaseClient,
  options: { dryRun: boolean } = { dryRun: true }
): Promise<RepairFeaturedModelBrandConsistencyResult> {
  let scanned = 0;
  let repaired = 0;
  let unchanged = 0;
  const mismatchesRaw: Array<{
    row: Row;
    canonicalBrand: string;
    wrongBrand: string;
  }> = [];

  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from("market_observations")
      .select("id, brand, model, model_key, title")
      .in("model_key", FEATURED_MODEL_KEYS)
      .range(from, to);
    if (error) throw new Error(`select featured rows failed: ${error.message}`);
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;
    from += rows.length;

    for (const row of rows) {
      const modelKey = row.model_key?.trim() ?? "";
      if (!modelKey) continue;
      const canonicalBrand = FEATURED_MODEL_TO_BRAND[modelKey] ?? null;
      if (!canonicalBrand) continue;
      const rowBrand = normalizeBrandKey(row.brand);
      if (rowBrand === canonicalBrand) continue;
      scanned += 1;
      mismatchesRaw.push({
        row,
        canonicalBrand,
        wrongBrand: asKey(rowBrand, "(empty)"),
      });
    }
  }

  const groupMap = new Map<string, MismatchGroup>();
  for (const m of mismatchesRaw) {
    const mk = asKey(m.row.model_key);
    const k = `${mk}__${m.canonicalBrand}__${m.wrongBrand}`;
    const existing = groupMap.get(k);
    if (existing) {
      existing.count += 1;
      if (existing.sample_ids.length < 8) existing.sample_ids.push(m.row.id);
      continue;
    }
    groupMap.set(k, {
      model_key: mk,
      canonical_brand: m.canonicalBrand,
      wrong_brand: m.wrongBrand,
      count: 1,
      sample_ids: [m.row.id],
    });
  }
  const mismatches = Array.from(groupMap.values()).sort((a, b) => b.count - a.count);

  const by_old_model_key: Record<string, number> = {};
  const by_new_model_key: Record<string, number> = {};

  for (const m of mismatchesRaw) {
    const oldKey = asKey(m.row.model_key);
    by_old_model_key[oldKey] = (by_old_model_key[oldKey] ?? 0) + 1;

    const newKey = computeRepairedModelKey(m.row);
    by_new_model_key[newKey] = (by_new_model_key[newKey] ?? 0) + 1;

    if (newKey === oldKey) {
      unchanged += 1;
      continue;
    }
    if (!options.dryRun) {
      const { error: updateError } = await supabase
        .from("market_observations")
        .update({ model_key: newKey })
        .eq("id", m.row.id);
      if (updateError) {
        throw new Error(`update id=${m.row.id} failed: ${updateError.message}`);
      }
    }
    repaired += 1;
  }

  return {
    scanned,
    repaired,
    unchanged,
    mismatches,
    by_old_model_key,
    by_new_model_key,
  };
}

function printResult(
  result: RepairFeaturedModelBrandConsistencyResult,
  dryRun: boolean
): void {
  console.log(
    `[repairFeaturedModelBrandConsistency] mode=${dryRun ? "dry-run" : "apply"}`
  );
  console.log(
    `scanned=${result.scanned} repaired=${result.repaired} unchanged=${result.unchanged}`
  );
  if (result.mismatches.length > 0) {
    console.log("\nMismatches (model_key / canonical_brand / wrong_brand):");
    for (const g of result.mismatches) {
      console.log(
        `  ${g.model_key} | canonical=${g.canonical_brand} | wrong=${g.wrong_brand} | count=${g.count} | sample_ids=${g.sample_ids.join(", ")}`
      );
    }
  }
  console.log("\nby_old_model_key:");
  for (const [k, v] of Object.entries(result.by_old_model_key)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("\nby_new_model_key:");
  for (const [k, v] of Object.entries(result.by_new_model_key)) {
    console.log(`  ${k}: ${v}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();
  const result = await repairFeaturedModelBrandConsistency(supabase, { dryRun });
  printResult(result, dryRun);
  if (dryRun) {
    console.log("\nRun with --apply to perform updates.");
  }
}

const __filename = fileURLToPath(import.meta.url);
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

