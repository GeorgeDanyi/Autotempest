/**
 * Audit konzistence brand <-> model_key v market_observations.
 * Source of truth pro expected brand je canonical parser z model_key.
 *
 * Usage:
 *   npx tsx lib/maintenance/auditBrandModelKeyConsistency.ts
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import { getBrandKeyFromModelKey } from "@/lib/cars/getBrandKeyFromModelKey";

const PAGE_SIZE = 1000;
const EXAMPLE_LIMIT = 25;

type ObservationRow = {
  id: string;
  source: string | null;
  source_listing_id: string | null;
  brand: string | null;
  model_key: string | null;
};

type MismatchExample = {
  id: string;
  source: string | null;
  source_listing_id: string | null;
  brand: string | null;
  model_key: string;
  expected_brand: string;
};

export type AuditBrandModelKeyConsistencyResult = {
  scanned: number;
  mismatches: number;
  byPair: Array<{
    model_key: string;
    expected_brand: string;
    actual_brand: string;
    count: number;
  }>;
  examples: MismatchExample[];
};

export async function auditBrandModelKeyConsistency(
  supabase: SupabaseClient,
): Promise<AuditBrandModelKeyConsistencyResult> {
  let offset = 0;
  let scanned = 0;
  let mismatches = 0;
  const byPair = new Map<string, number>();
  const examples: MismatchExample[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("market_observations")
      .select("id, source, source_listing_id, brand, model_key")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`audit select failed: ${error.message}`);
    const rows = (data ?? []) as ObservationRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const modelKey = String(row.model_key ?? "").trim().toLowerCase();
      if (!modelKey) continue;
      const expectedBrand = getBrandKeyFromModelKey(modelKey);
      if (!expectedBrand) continue;

      const actualBrand = normalizeBrandKey(row.brand);
      if (!actualBrand || actualBrand === expectedBrand) continue;

      mismatches += 1;
      const pairKey = `${modelKey}\t${expectedBrand}\t${actualBrand}`;
      byPair.set(pairKey, (byPair.get(pairKey) ?? 0) + 1);

      if (examples.length < EXAMPLE_LIMIT) {
        examples.push({
          id: row.id,
          source: row.source,
          source_listing_id: row.source_listing_id,
          brand: row.brand,
          model_key: modelKey,
          expected_brand: expectedBrand,
        });
      }
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  const byPairRows = Array.from(byPair.entries())
    .map(([k, count]) => {
      const [model_key, expected_brand, actual_brand] = k.split("\t");
      return { model_key, expected_brand, actual_brand, count };
    })
    .sort((a, b) => b.count - a.count);

  return { scanned, mismatches, byPair: byPairRows, examples };
}

async function main(): Promise<void> {
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();
  const result = await auditBrandModelKeyConsistency(supabase);

  console.error("[auditBrandModelKeyConsistency]");
  console.error(`scanned=${result.scanned}`);
  console.error(`mismatches=${result.mismatches}`);
  console.error("top_mismatch_pairs:");
  for (const row of result.byPair.slice(0, 20)) {
    console.error(
      `  model_key=${row.model_key} expected=${row.expected_brand} actual=${row.actual_brand} count=${row.count}`,
    );
  }
  console.error("examples:");
  for (const ex of result.examples) {
    console.error(
      `  id=${ex.id} source=${ex.source ?? "-"} source_listing_id=${ex.source_listing_id ?? "-"} brand=${ex.brand ?? "-"} model_key=${ex.model_key} expected_brand=${ex.expected_brand}`,
    );
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

