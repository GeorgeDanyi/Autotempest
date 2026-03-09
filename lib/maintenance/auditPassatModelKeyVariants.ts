/**
 * Audit variant model_key pro Passat (Volkswagen): všechny varianty, count, raw model values a ukázkové titulky.
 * Stejný princip jako auditOctaviaModelKeyVariants.
 *
 * Usage:
 *   npx tsx lib/maintenance/auditPassatModelKeyVariants.ts
 *   npx tsx lib/maintenance/auditPassatModelKeyVariants.ts --source=sauto
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";

const MAX_ROWS = 50_000;
const SAMPLE_TITLES_PER_KEY = 5;

type Row = {
  id: string;
  brand: string | null;
  model: string | null;
  model_key: string | null;
  title: string | null;
};

export type VariantGroup = {
  model_key: string;
  count: number;
  sample_titles: string[];
};

export type RawModelGroup = {
  model: string;
  count: number;
};

export type AuditPassatVariantsResult = {
  source: string;
  total_rows: number;
  variants: VariantGroup[];
  by_raw_model: RawModelGroup[];
};

function parseArgs(): { source: string } {
  const i = process.argv.findIndex((a) => a === "--source" || a.startsWith("--source="));
  if (i === -1) return { source: "sauto" };
  const arg = process.argv[i]!;
  if (arg.startsWith("--source=")) return { source: arg.slice("--source=".length).trim() || "sauto" };
  return { source: process.argv[i + 1]?.trim() || "sauto" };
}

export async function auditPassatModelKeyVariants(
  supabase: SupabaseClient,
  source: string
): Promise<AuditPassatVariantsResult> {
  const brandNorm = "volkswagen";
  const modelSlug = "passat";
  const pattern = "%passat%";

  const [byKeyRes, byModelRes] = await Promise.all([
    supabase
      .from("market_observations")
      .select("id, brand, model, model_key, title")
      .eq("source", source)
      .ilike("model_key", pattern)
      .limit(MAX_ROWS),
    supabase
      .from("market_observations")
      .select("id, brand, model, model_key, title")
      .eq("source", source)
      .ilike("model", pattern)
      .limit(MAX_ROWS),
  ]);

  if (byKeyRes.error) throw new Error(byKeyRes.error.message);
  if (byModelRes.error) throw new Error(byModelRes.error.message);

  const seen = new Set<string>();
  const merged: Row[] = [];
  for (const r of (byKeyRes.data ?? []) as Row[]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }
  for (const r of (byModelRes.data ?? []) as Row[]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  const filtered = merged.filter((r) => {
    const rowBrand = normalizeBrandKey(r.brand);
    if (rowBrand !== brandNorm) return false;
    const mk = (r.model_key ?? "").toLowerCase();
    const raw = (r.model ?? "").toLowerCase();
    return mk.includes(modelSlug) || raw.includes("passat");
  });

  const byModelKey = new Map<string, { count: number; titles: string[] }>();
  const byRawModel = new Map<string, number>();
  for (const r of filtered) {
    const mk = (r.model_key ?? "").trim() || "(empty)";
    const entry = byModelKey.get(mk);
    const title = (r.title ?? r.model ?? "").trim().slice(0, 80) || "(null)";
    if (!entry) {
      byModelKey.set(mk, { count: 1, titles: [title] });
    } else {
      entry.count += 1;
      if (entry.titles.length < SAMPLE_TITLES_PER_KEY && !entry.titles.includes(title)) {
        entry.titles.push(title);
      }
    }
    const rawModel = (r.model ?? "").trim() || "(empty)";
    byRawModel.set(rawModel, (byRawModel.get(rawModel) ?? 0) + 1);
  }

  const variants: VariantGroup[] = Array.from(byModelKey.entries())
    .map(([model_key, { count, titles }]) => ({ model_key, count, sample_titles: titles }))
    .sort((a, b) => b.count - a.count);

  const by_raw_model: RawModelGroup[] = Array.from(byRawModel.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  return {
    source,
    total_rows: filtered.length,
    variants,
    by_raw_model,
  };
}

function printResult(r: AuditPassatVariantsResult): void {
  console.log("\n--- Passat model_key variants (Volkswagen, source=" + r.source + ") ---");
  console.log("total_rows=" + r.total_rows);
  console.log("\n--- model_key | count ---");
  for (const v of r.variants) {
    console.log(v.model_key + "\t" + v.count);
  }
  console.log("\n--- model (raw) | count ---");
  for (const x of r.by_raw_model) {
    console.log(x.model + "\t" + x.count);
  }
  console.log("\n--- Sample titles per model_key ---");
  for (const v of r.variants) {
    console.log("\n" + v.model_key + " (" + v.count + "):");
    for (const t of v.sample_titles) {
      console.log("  " + t);
    }
  }
}

async function main(): Promise<void> {
  const { source } = parseArgs();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();
  const result = await auditPassatModelKeyVariants(supabase, source);
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
