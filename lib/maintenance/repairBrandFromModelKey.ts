/**
 * Repair brand display v market_observations podle canonical brand odvozeného z model_key.
 * Default je dry-run. Pro zápis použijte --apply.
 *
 * Usage:
 *   npx tsx lib/maintenance/repairBrandFromModelKey.ts
 *   npx tsx lib/maintenance/repairBrandFromModelKey.ts --apply
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBrandLabelFromKey, normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import { getBrandKeyFromModelKey } from "@/lib/cars/getBrandKeyFromModelKey";

const PAGE_SIZE = 1000;
const UPDATE_BATCH_SIZE = 200;

type ObservationRow = {
  id: string;
  brand: string | null;
  model_key: string | null;
};

type PlannedFix = {
  id: string;
  model_key: string;
  from_brand_key: string;
  to_brand_key: string;
  to_brand_display: string;
};

export type RepairBrandFromModelKeyResult = {
  scanned: number;
  matched: number;
  repaired: number;
  unchanged: number;
  by_model_key: Record<string, number>;
  by_to_brand_key: Record<string, number>;
};

export async function repairBrandFromModelKey(
  supabase: SupabaseClient,
  options: { apply?: boolean } = {},
): Promise<RepairBrandFromModelKeyResult> {
  let offset = 0;
  let scanned = 0;
  const fixes: PlannedFix[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("market_observations")
      .select("id, brand, model_key")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`repair select failed: ${error.message}`);
    const rows = (data ?? []) as ObservationRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const modelKey = String(row.model_key ?? "").trim().toLowerCase();
      if (!modelKey) continue;

      const expectedBrandKey = getBrandKeyFromModelKey(modelKey);
      if (!expectedBrandKey) continue;
      const currentBrandKey = normalizeBrandKey(row.brand);
      if (currentBrandKey === expectedBrandKey) continue;

      fixes.push({
        id: row.id,
        model_key: modelKey,
        from_brand_key: currentBrandKey || "(empty)",
        to_brand_key: expectedBrandKey,
        to_brand_display: formatBrandLabelFromKey(expectedBrandKey),
      });
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  let repaired = 0;
  if (options.apply && fixes.length > 0) {
    for (let i = 0; i < fixes.length; i += UPDATE_BATCH_SIZE) {
      const batch = fixes.slice(i, i + UPDATE_BATCH_SIZE);
      for (const fix of batch) {
        const { error: updateError } = await supabase
          .from("market_observations")
          .update({ brand: fix.to_brand_display })
          .eq("id", fix.id);
        if (updateError) {
          throw new Error(`repair update failed id=${fix.id}: ${updateError.message}`);
        }
        repaired += 1;
      }
    }
  }

  const by_model_key: Record<string, number> = {};
  const by_to_brand_key: Record<string, number> = {};
  for (const fix of fixes) {
    by_model_key[fix.model_key] = (by_model_key[fix.model_key] ?? 0) + 1;
    by_to_brand_key[fix.to_brand_key] = (by_to_brand_key[fix.to_brand_key] ?? 0) + 1;
  }

  return {
    scanned,
    matched: fixes.length,
    repaired,
    unchanged: scanned - fixes.length,
    by_model_key,
    by_to_brand_key,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await repairBrandFromModelKey(supabase, { apply });
  console.error("[repairBrandFromModelKey]");
  console.error(`scanned=${result.scanned}`);
  console.error(`matched=${result.matched}`);
  console.error(`unchanged=${result.unchanged}`);
  console.error("by_model_key:", result.by_model_key);
  console.error("by_to_brand_key:", result.by_to_brand_key);
  if (apply) {
    console.error(`repaired=${result.repaired}`);
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

