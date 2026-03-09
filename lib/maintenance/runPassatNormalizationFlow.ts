/**
 * Kompletní workflow: deep ingest Passat → audit variant → backfill (dry-run / apply) → rebuild price index → quality report.
 * Ověří dopad passat aliasů na data a posílí volkswagen_passat pro beta test.
 *
 * Usage:
 *   npx tsx lib/maintenance/runPassatNormalizationFlow.ts
 *   npx tsx lib/maintenance/runPassatNormalizationFlow.ts --pages=30
 *   npx tsx lib/maintenance/runPassatNormalizationFlow.ts --apply
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runSautoIngest } from "@/lib/ingest/sources/sauto";
import { getIngestQualitySummaryForModelKey } from "@/lib/ingest/ingestQualitySummary";
import { auditPassatModelKeyVariants } from "@/lib/maintenance/auditPassatModelKeyVariants";
import { auditPassatOutputModelKeys } from "@/lib/maintenance/auditPassatOutputModelKeys";
import { backfillPassatModelKey } from "@/lib/maintenance/backfillPassatModelKey";
import { rebuildPriceIndex } from "@/lib/pricing/rebuildPriceIndex";

const TARGET_MODEL_KEY = "volkswagen_passat";
const DEFAULT_PAGES = 50;

function parseArgs(): { pages: number; apply: boolean } {
  let pages = DEFAULT_PAGES;
  const pagesIdx = process.argv.findIndex((a) => a === "--pages" || a.startsWith("--pages="));
  if (pagesIdx !== -1) {
    const arg = process.argv[pagesIdx]!;
    const val = arg.startsWith("--pages=") ? arg.slice("--pages=".length).trim() : process.argv[pagesIdx + 1]?.trim();
    const n = parseInt(val ?? "", 10);
    if (Number.isFinite(n) && n > 0) pages = Math.min(n, 200);
  }
  const apply = process.argv.includes("--apply");
  return { pages, apply };
}

export type PassatFlowReport = {
  /** Quality pro volkswagen_passat na začátku (před ingestem). */
  quality_at_start: {
    total_rows: number;
    pricing_ready_rows: number;
    missing_engine_key: number;
    missing_mileage_km: number;
    median_price_czk: number | null;
  };
  ingest: {
    total_listings_found: number;
    total_saved: number;
    inserted: number;
    updated: number;
    pricing_ready_count: number;
  };
  /** Model-specific override: model_key z kontextu běhu, ne z titulku. */
  override_report?: {
    model_key_override_applied: boolean;
    model_key_override_target: string;
    rows_receiving_override: number;
    rows_that_would_have_been_elsewhere: number;
  };
  audit: {
    total_rows_passat: number;
    variant_count: number;
    variant_keys: string[];
  };
  audit_output_model_keys?: { total_passat_related: number; by_model_key: { model_key: string; count: number }[] };
  backfill_dry: { would_update: number; scanned: number };
  backfill_apply?: { updated: number };
  quality_before: {
    total_rows: number;
    pricing_ready_rows: number;
    missing_engine_key: number;
    missing_mileage_km: number;
    median_price_czk: number | null;
  };
  quality_after: {
    total_rows: number;
    pricing_ready_rows: number;
    missing_engine_key: number;
    missing_mileage_km: number;
    median_price_czk: number | null;
  };
};

export async function runPassatNormalizationFlow(
  supabase: SupabaseClient,
  options: { pages: number; apply: boolean } = { pages: DEFAULT_PAGES, apply: false }
): Promise<PassatFlowReport> {
  const { pages, apply } = options;

  console.log("\n[0] Quality volkswagen_passat at start (before ingest)");
  const qualityAtStart = await getIngestQualitySummaryForModelKey(supabase, "sauto", TARGET_MODEL_KEY);

  console.log("\n[A] Deep ingest Sauto Passat (pages=" + pages + ")");
  const ingestResult = await runSautoIngest(supabase, {
    brand: "volkswagen",
    model: "passat",
    pages,
  });
  const funnel = (ingestResult.funnel ?? {}) as Record<string, number | string | boolean>;
  const ingest = {
    total_listings_found: (funnel.total_listings_found as number) ?? ingestResult.saved,
    total_saved: ingestResult.saved,
    inserted: ingestResult.inserted,
    updated: ingestResult.updated,
    pricing_ready_count: (funnel.pricing_ready_count as number) ?? 0,
  };
  const override_report =
    funnel.model_key_override_applied === true
      ? {
          model_key_override_applied: true as const,
          model_key_override_target: String(funnel.model_key_override_target ?? TARGET_MODEL_KEY),
          rows_receiving_override: Number(funnel.rows_receiving_override ?? 0),
          rows_that_would_have_been_elsewhere: Number(funnel.rows_that_would_have_been_elsewhere ?? 0),
        }
      : undefined;

  console.log("\n[B] Quality summary (after ingest, before backfill)");
  const qualityBefore = await getIngestQualitySummaryForModelKey(supabase, "sauto", TARGET_MODEL_KEY);

  console.log("\n[C] Audit Passat variants");
  const auditResult = await auditPassatModelKeyVariants(supabase, "sauto");
  const audit = {
    total_rows_passat: auditResult.total_rows,
    variant_count: auditResult.variants.length,
    variant_keys: auditResult.variants.map((v) => v.model_key),
  };

  console.log("\n[C2] Audit output model keys (passat-related rows by model_key)");
  const auditOutput = await auditPassatOutputModelKeys(supabase, "sauto");
  const audit_output_model_keys = {
    total_passat_related: auditOutput.total_passat_related,
    by_model_key: auditOutput.by_output_model_key.map((g) => ({ model_key: g.model_key, count: g.count })),
  };

  console.log("\n[D] Backfill dry-run");
  const backfillDry = await backfillPassatModelKey(supabase, { dryRun: true });
  let backfillApply: { updated: number } | undefined;
  if (apply && backfillDry.would_update > 0) {
    console.log("\n[E] Backfill apply");
    const applyResult = await backfillPassatModelKey(supabase, { dryRun: false });
    backfillApply = { updated: applyResult.updated };
  } else if (apply) {
    console.log("\n[E] Backfill apply skipped (would_update=0)");
  }

  console.log("\n[F] Rebuild price index");
  await rebuildPriceIndex(supabase);

  console.log("\n[G] Quality summary (after backfill + rebuild)");
  const qualityAfter = await getIngestQualitySummaryForModelKey(supabase, "sauto", TARGET_MODEL_KEY);

  return {
    quality_at_start: {
      total_rows: qualityAtStart.total_rows,
      pricing_ready_rows: qualityAtStart.pricing_ready_rows,
      missing_engine_key: qualityAtStart.missing_engine_key,
      missing_mileage_km: qualityAtStart.missing_mileage_km,
      median_price_czk: qualityAtStart.median_price_czk,
    },
    ingest,
    override_report,
    audit,
    audit_output_model_keys,
    backfill_dry: { would_update: backfillDry.would_update, scanned: backfillDry.scanned },
    backfill_apply: backfillApply,
    quality_before: {
      total_rows: qualityBefore.total_rows,
      pricing_ready_rows: qualityBefore.pricing_ready_rows,
      missing_engine_key: qualityBefore.missing_engine_key,
      missing_mileage_km: qualityBefore.missing_mileage_km,
      median_price_czk: qualityBefore.median_price_czk,
    },
    quality_after: {
      total_rows: qualityAfter.total_rows,
      pricing_ready_rows: qualityAfter.pricing_ready_rows,
      missing_engine_key: qualityAfter.missing_engine_key,
      missing_mileage_km: qualityAfter.missing_mileage_km,
      median_price_czk: qualityAfter.median_price_czk,
    },
  };
}

function printReport(r: PassatFlowReport, apply: boolean): void {
  const merged = r.backfill_apply?.updated ?? r.backfill_dry.would_update;

  console.log("\n========== PASSAT NORMALIZATION REPORT ==========");

  if (r.override_report?.model_key_override_applied) {
    console.log("\n--- Model-specific override (beta seeding) ---");
    console.log("  model_key byl při tomto běhu řízen kontextem deep crawlu, ne čistou inferencí z titulku.");
    console.log("  target_model_key: " + r.override_report.model_key_override_target);
    console.log("  rows_receiving_override: " + r.override_report.rows_receiving_override);
    console.log("  rows_that_would_have_been_elsewhere (bez override): " + r.override_report.rows_that_would_have_been_elsewhere);
  }

  console.log("\n--- Ingest ---");
  console.log("  passat listings found (unique in run): " + r.ingest.total_listings_found);
  console.log("  total_saved: " + r.ingest.total_saved + " (inserted: " + r.ingest.inserted + ", updated: " + r.ingest.updated + ")");
  console.log("  pricing_ready_count (in run): " + r.ingest.pricing_ready_count);

  if (r.audit_output_model_keys) {
    console.log("\n--- Audit output model_key (passat-related) ---");
    console.log("  total_passat_related: " + r.audit_output_model_keys.total_passat_related);
    for (const g of r.audit_output_model_keys.by_model_key) {
      console.log("    " + g.model_key + ": " + g.count);
    }
  }

  console.log("\n--- Audit variants ---");
  console.log("  total_rows (all Passat variants): " + r.audit.total_rows_passat);
  console.log("  variant_count (model_key): " + r.audit.variant_count);
  console.log("  variant_keys: " + r.audit.variant_keys.join(", ") || "(none)");

  console.log("\n--- Backfill ---");
  console.log("  would_update (dry-run): " + r.backfill_dry.would_update);
  if (r.backfill_apply != null) {
    console.log("  updated (apply): " + r.backfill_apply.updated);
  }
  console.log("  rows merged into " + TARGET_MODEL_KEY + ": " + (r.backfill_apply?.updated ?? merged));

  console.log("\n--- Quality: před vs po (celý flow) ---");
  console.log("  AT START (před ingestem):");
  console.log("    total_rows: " + r.quality_at_start.total_rows);
  console.log("    pricing_ready_rows: " + r.quality_at_start.pricing_ready_rows);
  console.log("    missing_engine_key: " + r.quality_at_start.missing_engine_key + "  missing_mileage_km: " + r.quality_at_start.missing_mileage_km);
  console.log("  AFTER INGEST (před backfill):");
  console.log("    total_rows: " + r.quality_before.total_rows);
  console.log("    pricing_ready_rows: " + r.quality_before.pricing_ready_rows);
  console.log("    missing_engine_key: " + r.quality_before.missing_engine_key + "  missing_mileage_km: " + r.quality_before.missing_mileage_km);
  console.log("  AFTER BACKFILL + REBUILD:");
  console.log("    total_rows: " + r.quality_after.total_rows);
  console.log("    pricing_ready_rows: " + r.quality_after.pricing_ready_rows);
  console.log("    missing_engine_key: " + r.quality_after.missing_engine_key + "  missing_mileage_km: " + r.quality_after.missing_mileage_km);
  console.log("  DELTA (start -> end):");
  console.log("    total_rows: " + r.quality_at_start.total_rows + " -> " + r.quality_after.total_rows + " (" + (r.quality_after.total_rows - r.quality_at_start.total_rows >= 0 ? "+" : "") + (r.quality_after.total_rows - r.quality_at_start.total_rows) + ")");
  console.log("    pricing_ready_rows: " + r.quality_at_start.pricing_ready_rows + " -> " + r.quality_after.pricing_ready_rows + " (" + (r.quality_after.pricing_ready_rows - r.quality_at_start.pricing_ready_rows >= 0 ? "+" : "") + (r.quality_after.pricing_ready_rows - r.quality_at_start.pricing_ready_rows) + ")");

  console.log("");
  if (r.quality_after.pricing_ready_rows >= 10) {
    console.log("volkswagen_passat is ready for beta (pricing_ready_rows >= 10).");
  } else {
    console.log("volkswagen_passat has pricing_ready_rows " + r.quality_after.pricing_ready_rows + " (consider more pages or check fragmentace).");
  }
  if (!apply && r.backfill_dry.would_update > 0) {
    console.log("Run with --apply to perform backfill updates.");
  }
}

async function main(): Promise<void> {
  const { pages, apply } = parseArgs();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  console.log("[runPassatNormalizationFlow] pages=" + pages + " apply=" + apply);

  const report = await runPassatNormalizationFlow(supabase, { pages, apply });
  printReport(report, apply);
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
