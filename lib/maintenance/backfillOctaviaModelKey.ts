/**
 * Backfill model_key na skoda_octavia pro řádky, které po rozšíření aliasů
 * (octavia iii, octavia iii combi, octavia scout atd.) mají patřit do hlavního model_key.
 *
 * Pouze řádky kde source=sauto a model_key začíná na "skoda_octavia" (jakákoliv varianta).
 * Přepočet: normalizeModelKey({ brand, model, trim: title }) – pokud výsledek je skoda_octavia,
 * řádek se aktualizuje.
 *
 * Usage:
 *   npx tsx lib/maintenance/backfillOctaviaModelKey.ts --dry-run
 *   npx tsx lib/maintenance/backfillOctaviaModelKey.ts --apply
 *
 * Doporučený postup po --apply:
 *   1. Znovu spustit audit variant: npx tsx lib/maintenance/auditOctaviaModelKeyVariants.ts --source=sauto
 *   2. Rebuild price index: (např. přes runIngest nebo samostatně rebuildPriceIndex)
 *   3. Zkontrolovat pricing_ready pro skoda_octavia: npx tsx lib/ingest/runIngest.ts --source=sauto --quality-model=skoda_octavia
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeModelKey } from "@/lib/cars/normalizeModel";

const TARGET_MODEL_KEY = "skoda_octavia";
const SOURCE = "sauto";
const BATCH_SIZE = 200;

type Row = {
  id: number;
  brand: string | null;
  model: string | null;
  model_key: string | null;
  title: string | null;
  trim?: string | null;
};

export type BackfillOctaviaResult = {
  scanned: number;
  would_update: number;
  updated: number;
  skipped: number;
  examples: { id: number; old_key: string; new_key: string }[];
};

export async function backfillOctaviaModelKey(
  supabase: SupabaseClient,
  options: { dryRun: boolean } = { dryRun: true }
): Promise<BackfillOctaviaResult> {
  let scanned = 0;
  let would_update = 0;
  let updated = 0;
  let skipped = 0;
  const examples: { id: number; old_key: string; new_key: string }[] = [];
  let lastId: number | null = null;

  // Only rows that are Octavia variants (any skoda_octavia_*)
  // We use ilike so we get skoda_octavia, skoda_octavia_iii, etc.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase
      .from("market_observations")
      .select("id, brand, model, model_key, title, trim")
      .eq("source", SOURCE)
      .ilike("model_key", "skoda_octavia%")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId != null) {
      query = query.gt("id", lastId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`backfill select: ${error.message}`);
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      lastId = row.id;

      const trimSource = (row.title ?? row.trim ?? "").trim() || null;
      const newKey = normalizeModelKey({
        brand: row.brand,
        model: row.model,
        trim: trimSource,
      });

      if (newKey !== TARGET_MODEL_KEY) {
        skipped += 1;
        continue;
      }
      if (row.model_key === TARGET_MODEL_KEY) {
        skipped += 1;
        continue;
      }

      would_update += 1;
      if (examples.length < 15) {
        examples.push({
          id: row.id,
          old_key: row.model_key ?? "(null)",
          new_key: newKey,
        });
      }

      if (!options.dryRun) {
        const { error: updateError } = await supabase
          .from("market_observations")
          .update({ model_key: TARGET_MODEL_KEY })
          .eq("id", row.id);

        if (updateError) {
          console.error("[backfillOctaviaModelKey] update error id=" + row.id, updateError.message);
          skipped += 1;
          continue;
        }
        updated += 1;
      }
    }
  }

  return { scanned, would_update, updated, skipped, examples };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");

  if (!dryRun && !apply) {
    console.error("Use --dry-run or --apply");
    process.exit(1);
  }
  if (apply && dryRun) {
    console.error("Use only one of --dry-run or --apply");
    process.exit(1);
  }

  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await backfillOctaviaModelKey(supabase, { dryRun });

  console.log("[backfillOctaviaModelKey] source=" + SOURCE + " target=" + TARGET_MODEL_KEY);
  console.log("scanned=" + result.scanned + " would_update=" + result.would_update + " updated=" + result.updated + " skipped=" + result.skipped);

  if (result.examples.length > 0) {
    console.log("Examples (old_key -> new_key):");
    for (const ex of result.examples) {
      console.log("  id=" + ex.id + " " + ex.old_key + " -> " + ex.new_key);
    }
  }

  if (dryRun && result.would_update > 0) {
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
