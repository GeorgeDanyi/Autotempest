/**
 * Audit uniqueness source_listing_id pro daný source + model (model_key).
 * Ukáže: kolik řádků v DB pro tento model_key, kolik unikátních source_listing_id,
 * zda existují duplicity (stejný source_listing_id vícekrát – porušení očekávaného unikátu),
 * vzorky ID.
 *
 * Pomáhá vysvětlit rozdíl funnel (total_saved) vs quality summary (total_rows pro model_key):
 * - pokud inserted + updated = 104 ale total_rows pro skoda_octavia = 28, pak 76 řádků
 *   má po uložení jiný model_key (normalizace), nebo jde o update stávajících řádků
 *   které už v DB měly jiný model_key a teď je přepsal tento běh.
 *
 * Usage:
 *   npx tsx lib/maintenance/auditSourceListingUniqueness.ts --source=sauto --brand=skoda --model=octavia
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildModelKey } from "@/lib/ingest/textNormalize";

const MAX_ROWS = 100_000;

type Row = { source_listing_id: string };

export type AuditUniquenessResult = {
  source: string;
  model_key: string;
  total_rows: number;
  distinct_source_listing_ids: number;
  duplicate_row_count: number;
  duplicate_ids: { source_listing_id: string; count: number }[];
  sample_ids: string[];
};

function parseArgs(): { source: string; brand: string; model: string } {
  const get = (name: string): string => {
    const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i === -1) return "";
    const arg = process.argv[i]!;
    if (arg.startsWith(`--${name}=`)) return arg.slice(`--${name}=`.length).trim();
    return process.argv[i + 1]?.trim() ?? "";
  };
  return {
    source: get("source") || "sauto",
    brand: get("brand") || "skoda",
    model: get("model") || "octavia",
  };
}

export async function auditSourceListingUniqueness(
  supabase: SupabaseClient,
  source: string,
  brand: string,
  model: string
): Promise<AuditUniquenessResult> {
  const model_key = buildModelKey(brand, model);

  const { data: rows, error } = await supabase
    .from("market_observations")
    .select("source_listing_id")
    .eq("source", source)
    .eq("model_key", model_key)
    .limit(MAX_ROWS);

  if (error) throw new Error(`audit select: ${error.message}`);

  const list = (rows ?? []) as Row[];
  const total_rows = list.length;

  const byId = new Map<string, number>();
  for (const r of list) {
    const id = (r.source_listing_id ?? "").trim() || "(empty)";
    byId.set(id, (byId.get(id) ?? 0) + 1);
  }

  const distinct_source_listing_ids = byId.size;
  const duplicate_ids: { source_listing_id: string; count: number }[] = [];
  for (const [id, count] of byId) {
    if (count > 1) duplicate_ids.push({ source_listing_id: id, count });
  }
  duplicate_ids.sort((a, b) => b.count - a.count);

  const duplicate_row_count = total_rows - distinct_source_listing_ids;
  const sample_ids = list.slice(0, 25).map((r) => (r.source_listing_id ?? "").trim() || "(empty)");

  return {
    source,
    model_key,
    total_rows,
    distinct_source_listing_ids,
    duplicate_row_count,
    duplicate_ids,
    sample_ids,
  };
}

function printResult(r: AuditUniquenessResult): void {
  console.log("\n--- Audit source_listing_id uniqueness ---");
  console.log(`source=${r.source} model_key=${r.model_key}`);
  console.log(`total_rows=${r.total_rows}`);
  console.log(`distinct_source_listing_ids=${r.distinct_source_listing_ids}`);
  console.log(`duplicate_row_count=${r.duplicate_row_count} (rows that are duplicate ids; 0 = correct)`);

  if (r.duplicate_ids.length > 0) {
    console.log("\n--- Duplicate source_listing_id (count > 1) ---");
    for (const x of r.duplicate_ids.slice(0, 20)) {
      console.log(`${x.source_listing_id}\t${x.count}`);
    }
  }

  console.log("\n--- Sample source_listing_id ---");
  for (const id of r.sample_ids) {
    console.log(id);
  }

  console.log("\n--- Summary ---");
  if (r.duplicate_row_count > 0) {
    console.log("WARNING: DB has duplicate source_listing_id for this model_key (expected unique source+source_listing_id).");
  } else {
    console.log("OK: total_rows === distinct_source_listing_ids (one row per listing for this model_key).");
  }
  console.log("Interpretation: quality summary total_rows for this model_key =", r.total_rows, "= number of unique listings stored under this model_key.");
}

async function main(): Promise<void> {
  const { source, brand, model } = parseArgs();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await auditSourceListingUniqueness(supabase, source, brand, model);
  printResult(result);
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
