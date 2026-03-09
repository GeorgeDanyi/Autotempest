/**
 * Backfill market_observations.brand: nahradí nekonzistentní hodnoty (Land, Skoda, Bmw, …)
 * konzistentním display tvarem (Land Rover, Škoda, BMW) podle shared mapy v normalizeBrandKey.
 *
 * Usage:
 *   npx tsx lib/maintenance/backfillBrandDisplay.ts           # dry-run (vypíše změny)
 *   npx tsx lib/maintenance/backfillBrandDisplay.ts --apply  # provede UPDATE v DB
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandForDb } from "@/lib/analyze/normalizeBrandKey";

export type BackfillBrandDisplayResult = {
  distinctBrands: number;
  updates: { from: string; to: string; count: number }[];
  rowsUpdated: number;
};

/**
 * Pro každý distinct brand v market_observations spočítá display hodnotu.
 * Vrátí seznam (from, to, count) kde from !== to a počet řádků k update.
 */
export async function backfillBrandDisplay(
  supabase: SupabaseClient,
  options: { apply?: boolean } = {}
): Promise<BackfillBrandDisplayResult> {
  const { data: rows, error: selectError } = await supabase
    .from("market_observations")
    .select("brand");

  if (selectError) {
    throw new Error(`backfillBrandDisplay select: ${selectError.message}`);
  }

  const list = (rows ?? []) as { brand: string | null }[];
  const countByBrand = new Map<string, number>();
  for (const r of list) {
    const b = r.brand != null ? String(r.brand).trim() : "";
    if (b === "") continue;
    countByBrand.set(b, (countByBrand.get(b) ?? 0) + 1);
  }

  const updates: { from: string; to: string; count: number }[] = [];
  for (const [currentBrand, count] of countByBrand) {
    const displayBrand = normalizeBrandForDb(currentBrand);
    if (displayBrand == null || displayBrand === currentBrand) continue;
    updates.push({ from: currentBrand, to: displayBrand, count });
  }

  let rowsUpdated = 0;
  if (options.apply && updates.length > 0) {
    for (const { from, to } of updates) {
      const { data, error } = await supabase
        .from("market_observations")
        .update({ brand: to })
        .eq("brand", from)
        .select("id");

      if (error) {
        throw new Error(`backfillBrandDisplay update "${from}" -> "${to}": ${error.message}`);
      }
      rowsUpdated += data?.length ?? 0;
    }
  }

  return {
    distinctBrands: countByBrand.size,
    updates,
    rowsUpdated,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await backfillBrandDisplay(supabase, { apply });

  console.error("[backfillBrandDisplay]");
  console.error(`distinct_brands=${result.distinctBrands}`);
  console.error(`updates_planned=${result.updates.length}`);
  if (result.updates.length > 0) {
    for (const u of result.updates) {
      console.error(`  "${u.from}" -> "${u.to}" (${u.count} rows)`);
    }
  }
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
