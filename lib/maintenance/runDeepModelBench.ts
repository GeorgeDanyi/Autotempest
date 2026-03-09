/**
 * Série model-specific deep crawlů pro Sauto – benchmark coverage klíčových modelů.
 * Spustí sekvenčně ingest pro každý model (50 stránek), po každém načte quality summary
 * a na konci vypíše souhrnnou tabulku.
 *
 * Usage:
 *   npx tsx lib/maintenance/runDeepModelBench.ts
 *   npx tsx lib/maintenance/runDeepModelBench.ts --pages=20
 *
 * Na konci nevolá rebuildPriceIndex – to lze spustit zvlášť (např. runIngest).
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runSautoIngest } from "@/lib/ingest/sources/sauto";
import { getIngestQualitySummaryForModelKey } from "@/lib/ingest/ingestQualitySummary";
import { buildModelKey } from "@/lib/ingest/textNormalize";

const DEFAULT_PAGES = 50;

const BENCH_MODELS: { brand: string; model: string }[] = [
  { brand: "skoda", model: "superb" },
  { brand: "skoda", model: "fabia" },
  { brand: "volkswagen", model: "golf" },
  { brand: "volkswagen", model: "passat" },
];

export type BenchRow = {
  model_key: string;
  source: string;
  brand: string;
  model: string;
  pages_requested: number;
  total_listings_found: number;
  total_saved: number;
  inserted: number;
  updated: number;
  pricing_ready_count: number;
  total_rows_for_model_key: number;
  pricing_ready_rows_for_model_key: number;
  missing_engine_key: number;
  missing_mileage_km: number;
};

function parsePages(): number {
  const i = process.argv.findIndex((a) => a === "--pages" || a.startsWith("--pages="));
  if (i === -1) return DEFAULT_PAGES;
  const arg = process.argv[i]!;
  const val = arg.startsWith("--pages=") ? arg.slice("--pages=".length).trim() : process.argv[i + 1]?.trim();
  const n = parseInt(val ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : DEFAULT_PAGES;
}

export async function runDeepModelBench(
  supabase: SupabaseClient,
  options: { pages: number } = { pages: DEFAULT_PAGES }
): Promise<BenchRow[]> {
  const pages = options.pages;
  const results: BenchRow[] = [];

  for (const { brand, model } of BENCH_MODELS) {
    const model_key = buildModelKey(brand, model);
    console.log("\n--- [" + model_key + "] brand=" + brand + " model=" + model + " pages=" + pages + " ---");

    const result = await runSautoIngest(supabase, { brand, model, pages });
    const funnel = result.funnel as Record<string, number | string> | undefined;

    const total_listings_found = (funnel?.total_listings_found as number) ?? result.saved;
    const total_saved = result.saved;
    const inserted = result.inserted;
    const updated = result.updated;
    const pricing_ready_count = (funnel?.pricing_ready_count as number) ?? 0;
    const missing_mileage_count = (funnel?.missing_mileage_count as number) ?? 0;
    const missing_engine_key_count = (funnel?.missing_engine_key_count as number) ?? 0;

    const quality = await getIngestQualitySummaryForModelKey(supabase, "sauto", model_key);

    const row: BenchRow = {
      model_key,
      source: "sauto",
      brand,
      model,
      pages_requested: pages,
      total_listings_found,
      total_saved,
      inserted,
      updated,
      pricing_ready_count,
      total_rows_for_model_key: quality.total_rows,
      pricing_ready_rows_for_model_key: quality.pricing_ready_rows,
      missing_engine_key: quality.missing_engine_key,
      missing_mileage_km: quality.missing_mileage_km,
    };
    results.push(row);

    console.log("[bench][" + model_key + "] source=" + row.source + " brand=" + row.brand + " model=" + row.model);
    console.log("[bench][" + model_key + "] pages_requested=" + pages + " total_listings_found=" + total_listings_found + " total_saved=" + total_saved + " inserted=" + inserted + " updated=" + updated);
    console.log("[bench][" + model_key + "] pricing_ready_count=" + pricing_ready_count + " total_rows_for_model_key=" + row.total_rows_for_model_key + " pricing_ready_rows_for_model_key=" + row.pricing_ready_rows_for_model_key);
    console.log("[bench][" + model_key + "] missing_engine_key=" + row.missing_engine_key + " missing_mileage_km=" + row.missing_mileage_km);
  }

  return results;
}

function printSummaryTable(rows: BenchRow[]): void {
  console.log("\n========== SUMMARY TABLE ==========");
  const header = "model_key                    | total_saved | inserted | updated | pricing_ready_count | total_rows | pricing_ready_rows";
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of rows) {
    const line = [
      r.model_key.padEnd(28),
      String(r.total_saved).padStart(11),
      String(r.inserted).padStart(8),
      String(r.updated).padStart(8),
      String(r.pricing_ready_count).padStart(20),
      String(r.total_rows_for_model_key).padStart(11),
      String(r.pricing_ready_rows_for_model_key).padStart(19),
    ].join(" | ");
    console.log(line);
  }
  console.log("");
}

async function main(): Promise<void> {
  const pages = parsePages();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  console.log("[runDeepModelBench] source=sauto pages=" + pages + " models=" + BENCH_MODELS.length);

  const results = await runDeepModelBench(supabase, { pages });
  printSummaryTable(results);

  console.log("[runDeepModelBench] done. Run rebuildPriceIndex separately if needed (e.g. via runIngest).");
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
