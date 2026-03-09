/**
 * Repair market_observations: oprava řádků kde model_key == brand_key (nebo brand-only).
 * Jednoznačné případy: model_key odpovídá pouze značce → nastavíme model_key = brand_key_unknown, model = null.
 * Dry-run default; --apply zapíše změny.
 *
 * Usage:
 *   npx tsx lib/maintenance/repairModelKeyIntegrity.ts           # dry-run
 *   npx tsx lib/maintenance/repairModelKeyIntegrity.ts --apply
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import { isBrandOnlyOrGenericModelKey } from "@/lib/cars/normalizeModel";

const BATCH_SIZE = 500;

export type RepairModelKeyIntegrityResult = {
  rowsMatched: number;
  rowsUpdated: number;
  byBrandKey: Record<string, number>;
};

/**
 * Najde řádky kde model_key == brand_key nebo je brand-only; nastaví model_key = brand_key_unknown, model = null.
 */
export async function repairModelKeyIntegrity(
  supabase: SupabaseClient,
  options: { apply?: boolean } = {}
): Promise<RepairModelKeyIntegrityResult> {
  const { data: rows, error: selectError } = await supabase
    .from("market_observations")
    .select("id, brand, model, model_key");

  if (selectError) throw new Error(`repair select: ${selectError.message}`);

  const list = (rows ?? []) as { id: string; brand: string | null; model: string | null; model_key: string | null }[];
  const toRepair: { id: string; brand: string; brand_key: string }[] = [];

  for (const r of list) {
    const brand = r.brand != null ? String(r.brand).trim() : "";
    const model_key = r.model_key != null ? String(r.model_key).trim() : "";
    if (!model_key) continue;

    const brand_key = normalizeBrandKey(brand);
    const keyLower = model_key.toLowerCase();

    const isEqualsBrandKey = brand_key && keyLower === brand_key;
    const isBrandOnly = isBrandOnlyOrGenericModelKey(model_key);

    if (isEqualsBrandKey || isBrandOnly) {
      toRepair.push({
        id: r.id,
        brand,
        brand_key: brand_key || keyLower,
      });
    }
  }

  const byBrandKey: Record<string, number> = {};
  for (const r of toRepair) {
    byBrandKey[r.brand_key] = (byBrandKey[r.brand_key] ?? 0) + 1;
  }

  let rowsUpdated = 0;
  if (options.apply && toRepair.length > 0) {
    for (let i = 0; i < toRepair.length; i += BATCH_SIZE) {
      const batch = toRepair.slice(i, i + BATCH_SIZE);
      for (const r of batch) {
        const newModelKey = `${r.brand_key}_unknown`;
        const { error: updateError } = await supabase
          .from("market_observations")
          .update({ model_key: newModelKey, model: null })
          .eq("id", r.id);

        if (updateError) {
          throw new Error(`repair update id=${r.id}: ${updateError.message}`);
        }
        rowsUpdated += 1;
      }
    }
  }

  return {
    rowsMatched: toRepair.length,
    rowsUpdated,
    byBrandKey,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await repairModelKeyIntegrity(supabase, { apply });

  console.error("[repairModelKeyIntegrity]");
  console.error(`rows_matched=${result.rowsMatched}`);
  console.error("by_brand_key:", result.byBrandKey);
  if (apply) {
    console.error(`rows_updated=${result.rowsUpdated}`);
  } else {
    console.error("(dry-run; run with --apply to write changes)");
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
