/**
 * Audit market_observations: podezřelé řádky kde model_key == brand_key, model je jen část značky, nebo model_key je brand-only.
 * Report grouped by brand / model / model_key / count.
 *
 * Usage: npx tsx lib/maintenance/auditModelKeyIntegrity.ts
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";
import {
  isBrandOnlyOrGenericModelKey,
} from "@/lib/cars/normalizeModel";
import { isModelLikelyBrandSuffix } from "@/lib/cars/multiWordBrands";

const SAMPLE_LIMIT = 50_000;

type Row = {
  brand: string | null;
  model: string | null;
  model_key: string | null;
};

export type AuditRow = {
  brand: string;
  model: string;
  model_key: string;
  count: number;
  issue: "model_key_equals_brand_key" | "model_key_brand_only" | "model_likely_brand_suffix";
};

export type AuditModelKeyIntegrityResult = {
  totalRows: number;
  suspicious: AuditRow[];
  byIssue: Record<string, number>;
};

export async function auditModelKeyIntegrity(
  supabase: SupabaseClient
): Promise<AuditModelKeyIntegrityResult> {
  const { data: rows, error } = await supabase
    .from("market_observations")
    .select("brand, model, model_key")
    .limit(SAMPLE_LIMIT);

  if (error) throw new Error(`audit select: ${error.message}`);

  const list = (rows ?? []) as Row[];
  const totalRows = list.length;

  const byKey = new Map<string, { brand: string; model: string; model_key: string; count: number }>();

  for (const r of list) {
    const brand = r.brand != null ? String(r.brand).trim() : "";
    const model = r.model != null ? String(r.model).trim() : "";
    const model_key = r.model_key != null ? String(r.model_key).trim() : "";
    if (!brand && !model_key) continue;

    const key = `${brand}\t${model}\t${model_key}`;
    const cur = byKey.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      byKey.set(key, { brand, model, model_key, count: 1 });
    }
  }

  const suspicious: AuditRow[] = [];
  const byIssue: Record<string, number> = {};

  for (const [, v] of byKey) {
    const brandKey = normalizeBrandKey(v.brand);
    const mk = v.model_key.toLowerCase();

    if (brandKey && mk === brandKey) {
      suspicious.push({
        brand: v.brand,
        model: v.model,
        model_key: v.model_key,
        count: v.count,
        issue: "model_key_equals_brand_key",
      });
      byIssue.model_key_equals_brand_key = (byIssue.model_key_equals_brand_key ?? 0) + v.count;
      continue;
    }

    if (isBrandOnlyOrGenericModelKey(v.model_key)) {
      suspicious.push({
        brand: v.brand,
        model: v.model,
        model_key: v.model_key,
        count: v.count,
        issue: "model_key_brand_only",
      });
      byIssue.model_key_brand_only = (byIssue.model_key_brand_only ?? 0) + v.count;
      continue;
    }

    if (isModelLikelyBrandSuffix(v.brand, v.model)) {
      suspicious.push({
        brand: v.brand,
        model: v.model,
        model_key: v.model_key,
        count: v.count,
        issue: "model_likely_brand_suffix",
      });
      byIssue.model_likely_brand_suffix = (byIssue.model_likely_brand_suffix ?? 0) + v.count;
    }
  }

  suspicious.sort((a, b) => b.count - a.count);

  return {
    totalRows,
    suspicious,
    byIssue,
  };
}

async function main(): Promise<void> {
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await auditModelKeyIntegrity(supabase);

  console.error("[auditModelKeyIntegrity]");
  console.error(`total_rows_sampled=${result.totalRows}`);
  console.error("by_issue:", result.byIssue);
  console.error("suspicious (brand / model / model_key / count / issue):");
  for (const r of result.suspicious) {
    console.error(`  "${r.brand}" | "${r.model}" | "${r.model_key}" | ${r.count} | ${r.issue}`);
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
