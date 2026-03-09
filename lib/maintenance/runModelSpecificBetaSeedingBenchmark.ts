/**
 * Model-specific beta seeding benchmark: posílí vybrané modely stejným principem jako Passat
 * (deep ingest Sauto s --brand + --model, canonical model_key override) a vypíše report + souhrnnou tabulku.
 *
 * Modely: volkswagen_golf, skoda_superb, skoda_fabia.
 * Rebuild price index se volá jednou na konci celé série.
 *
 * Usage:
 *   npx tsx lib/maintenance/runModelSpecificBetaSeedingBenchmark.ts
 *   npx tsx lib/maintenance/runModelSpecificBetaSeedingBenchmark.ts --pages=30
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runSautoIngest } from "@/lib/ingest/sources/sauto";
import { getIngestQualitySummaryForModelKey } from "@/lib/ingest/ingestQualitySummary";
import { rebuildPriceIndex } from "@/lib/pricing/rebuildPriceIndex";

const SOURCE = "sauto";
const DEFAULT_PAGES = 50;
const BETA_READY_THRESHOLD = 10;

const MODELS: { brand: string; model: string; model_key: string }[] = [
  { brand: "volkswagen", model: "golf", model_key: "volkswagen_golf" },
  { brand: "skoda", model: "superb", model_key: "skoda_superb" },
  { brand: "skoda", model: "fabia", model_key: "skoda_fabia" },
];

export type ModelBenchmarkResult = {
  model_key: string;
  total_saved: number;
  inserted: number;
  updated: number;
  pricing_ready_count: number;
  total_rows_before: number;
  pricing_ready_before: number;
  total_rows_after: number;
  pricing_ready_after: number;
  delta_total_rows: number;
  delta_pricing_ready: number;
  rows_receiving_override: number;
  rows_that_would_have_been_elsewhere: number;
  missing_engine_key: number;
  missing_mileage_km: number;
  beta_ready: boolean;
};

function parsePages(): number {
  const i = process.argv.findIndex((a) => a === "--pages" || a.startsWith("--pages="));
  if (i === -1) return DEFAULT_PAGES;
  const arg = process.argv[i]!;
  const val = arg.startsWith("--pages=") ? arg.slice("--pages=".length).trim() : process.argv[i + 1]?.trim();
  const n = parseInt(val ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : DEFAULT_PAGES;
}

function extractOverrideFromFunnel(funnel: Record<string, unknown>): { rows_receiving_override: number; rows_that_would_have_been_elsewhere: number } {
  return {
    rows_receiving_override: Number(funnel.rows_receiving_override ?? 0),
    rows_that_would_have_been_elsewhere: Number(funnel.rows_that_would_have_been_elsewhere ?? 0),
  };
}

export async function runModelSpecificBetaSeedingBenchmark(
  supabase: SupabaseClient,
  options: { pages: number } = { pages: DEFAULT_PAGES }
): Promise<{ results: ModelBenchmarkResult[]; errors: string[] }> {
  const { pages } = options;
  const errors: string[] = [];
  const results: ModelBenchmarkResult[] = [];

  for (const { brand, model, model_key } of MODELS) {
    console.log("\n--- " + model_key + " ---");
    console.log("[1] Quality before");
    const qualityBefore = await getIngestQualitySummaryForModelKey(supabase, SOURCE, model_key);

    console.log("[2] Deep ingest (brand=" + brand + ", model=" + model + ", pages=" + pages + ")");
    const ingestResult = await runSautoIngest(supabase, { brand, model, pages });
    const funnel = (ingestResult.funnel ?? {}) as Record<string, unknown>;
    const override = extractOverrideFromFunnel(funnel);

    if (ingestResult.errors.length > 0) {
      errors.push(...ingestResult.errors.map((e) => `[${model_key}] ${e}`));
    }

    console.log("[3] Quality after");
    const qualityAfter = await getIngestQualitySummaryForModelKey(supabase, SOURCE, model_key);

    const total_saved = ingestResult.saved;
    const inserted = ingestResult.inserted;
    const updated = ingestResult.updated;
    const pricing_ready_count = Number(funnel.pricing_ready_count ?? 0);
    const total_rows_before = qualityBefore.total_rows;
    const pricing_ready_before = qualityBefore.pricing_ready_rows;
    const total_rows_after = qualityAfter.total_rows;
    const pricing_ready_after = qualityAfter.pricing_ready_rows;

    const result: ModelBenchmarkResult = {
      model_key,
      total_saved,
      inserted,
      updated,
      pricing_ready_count,
      total_rows_before,
      pricing_ready_before,
      total_rows_after,
      pricing_ready_after,
      delta_total_rows: total_rows_after - total_rows_before,
      delta_pricing_ready: pricing_ready_after - pricing_ready_before,
      rows_receiving_override: override.rows_receiving_override,
      rows_that_would_have_been_elsewhere: override.rows_that_would_have_been_elsewhere,
      missing_engine_key: qualityAfter.missing_engine_key,
      missing_mileage_km: qualityAfter.missing_mileage_km,
      beta_ready: pricing_ready_after >= BETA_READY_THRESHOLD,
    };
    results.push(result);
    printModelReport(result);
  }

  console.log("\n[4] Rebuild price index (once)");
  await rebuildPriceIndex(supabase);

  return { results, errors };
}

function printModelReport(r: ModelBenchmarkResult): void {
  console.log("\n  total_saved: " + r.total_saved + " (inserted: " + r.inserted + ", updated: " + r.updated + ")");
  console.log("  pricing_ready_count (in run): " + r.pricing_ready_count);
  console.log("  total_rows: " + r.total_rows_before + " -> " + r.total_rows_after + " (delta " + (r.delta_total_rows >= 0 ? "+" : "") + r.delta_total_rows + ")");
  console.log("  pricing_ready_rows: " + r.pricing_ready_before + " -> " + r.pricing_ready_after + " (delta " + (r.delta_pricing_ready >= 0 ? "+" : "") + r.delta_pricing_ready + ")");
  console.log("  rows_receiving_override: " + r.rows_receiving_override + ", would_have_been_elsewhere: " + r.rows_that_would_have_been_elsewhere);
  console.log("  missing_engine_key: " + r.missing_engine_key + ", missing_mileage_km: " + r.missing_mileage_km);
  console.log("  beta_ready: " + r.beta_ready);
}

function printSummaryTable(results: ModelBenchmarkResult[]): void {
  console.log("\n========== BETA SEEDING SUMMARY TABLE ==========");
  const header =
    "model_key              | total_rows_before | total_rows_after | pricing_ready_before | pricing_ready_after | delta_ready | override_rows | beta_ready";
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of results) {
    const line = [
      r.model_key.padEnd(22),
      String(r.total_rows_before).padStart(17),
      String(r.total_rows_after).padStart(16),
      String(r.pricing_ready_before).padStart(21),
      String(r.pricing_ready_after).padStart(20),
      (r.delta_pricing_ready >= 0 ? "+" : "") + r.delta_pricing_ready,
      String(r.rows_receiving_override).padStart(14),
      r.beta_ready ? "true" : "false",
    ].join(" | ");
    console.log(line);
  }
  console.log("");
}

async function main(): Promise<void> {
  const pages = parsePages();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  console.log("[runModelSpecificBetaSeedingBenchmark] pages=" + pages + ", models: " + MODELS.map((m) => m.model_key).join(", "));

  const { results, errors } = await runModelSpecificBetaSeedingBenchmark(supabase, { pages });

  if (errors.length > 0) {
    console.warn("[benchmark] errors:", errors);
  }

  printSummaryTable(results);

  const betaReady = results.filter((r) => r.beta_ready).map((r) => r.model_key);
  console.log("Beta-ready (pricing_ready_after >= " + BETA_READY_THRESHOLD + "): " + betaReady.join(", ") || "(none)");
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
