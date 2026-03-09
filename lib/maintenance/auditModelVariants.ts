/**
 * Audit model variants: po deep crawl pro brand+model zjistit, pod jakými model_key
 * a raw model/title se listingy skutečně ukládají. Odhalí ztrátu mezi raw listingy a finálním model_key.
 *
 * Možný zdroj variant: lib/cars/normalizeModel.ts – když MODEL_ALIASES neobsahuje
 * přesnou shodu (např. "Octavia III", "Octavia Scout"), použije se fallback
 * buildModelKey(brand, model) → skoda_octavia_iii, skoda_octavia_scout atd.
 * Rozšíření aliasů v modelAliases.ts (octavia_iii, octavia_scout → octavia) by
 * sloučilo varianty do hlavního model_key.
 *
 * Usage:
 *   npx tsx lib/maintenance/auditModelVariants.ts --source=sauto --brand=skoda --model=octavia
 *
 * Výstup:
 *   - model_key | count
 *   - model (raw) | count
 *   - title sample (prefix) | count
 *   - souhrn: kolik jako hlavní model_key, kolik pod variantami
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";

const MAX_ROWS = 50_000;
const TITLE_PREFIX_LEN = 56;
const TITLE_GROUP_NORMALIZE = true; // normalize diacritics + lowercase for grouping

type Row = {
  id: string;
  brand: string | null;
  model: string | null;
  model_key: string | null;
  title: string | null;
};

export type ModelVariantGroup = {
  model_key: string;
  count: number;
};

export type RawModelGroup = {
  model: string;
  count: number;
};

export type TitleSampleGroup = {
  titleSample: string;
  count: number;
};

export type AuditModelVariantsResult = {
  source: string;
  brandFilter: string;
  modelFilter: string;
  totalRows: number;
  byModelKey: ModelVariantGroup[];
  byRawModel: RawModelGroup[];
  byTitleSample: TitleSampleGroup[];
  mainModelKey: string;
  mainModelKeyCount: number;
  otherVariantsCount: number;
  otherModelKeys: ModelVariantGroup[];
};

function parseArgs(): { source: string; brand: string; model: string } {
  const get = (name: string): string => {
    const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i === -1) return "";
    const arg = process.argv[i]!;
    if (arg.startsWith(`--${name}=`)) return arg.slice(`--${name}=`.length).trim();
    return process.argv[i + 1]?.trim() ?? "";
  };
  const source = get("source") || "sauto";
  const brand = get("brand") || "skoda";
  const model = get("model") || "octavia";
  return { source, brand, model };
}

function normalizeTitleForGroup(s: string | null | undefined): string {
  if (s == null) return "(null)";
  const t = String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, TITLE_PREFIX_LEN) || "(empty)";
}

function matchesModel(row: Row, brandNorm: string, modelSlug: string): boolean {
  const rowBrandKey = normalizeBrandKey(row.brand);
  if (rowBrandKey !== brandNorm) return false;
  const mk = (row.model_key ?? "").toLowerCase();
  const modelRaw = (row.model ?? "").toLowerCase();
  return mk.includes(modelSlug) || modelRaw.includes(modelSlug);
}

export async function auditModelVariants(
  supabase: SupabaseClient,
  source: string,
  brand: string,
  model: string
): Promise<AuditModelVariantsResult> {
  const brandNorm = normalizeBrandKey(brand);
  const modelSlug = model
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const mainModelKey = `${brandNorm}_${modelSlug}`;

  // Load rows where model_key or model contains model slug (two queries, merge by id)
  const pattern = `%${modelSlug}%`;
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

  if (byKeyRes.error) throw new Error(`audit model_key select: ${byKeyRes.error.message}`);
  if (byModelRes.error) throw new Error(`audit model select: ${byModelRes.error.message}`);

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

  const filtered = merged.filter((r) => matchesModel(r, brandNorm, modelSlug));
  return buildResult(
    filtered,
    source,
    brand,
    model,
    mainModelKey,
    brandNorm,
    modelSlug
  );
}

function buildResult(
  filtered: Row[],
  source: string,
  brand: string,
  model: string,
  mainModelKey: string,
  _brandNorm: string,
  _modelSlug: string
): AuditModelVariantsResult {
  const totalRows = filtered.length;
  const byModelKey = new Map<string, number>();
  const byRawModel = new Map<string, number>();
  const byTitleSample = new Map<string, number>();

  for (const r of filtered) {
    const mk = (r.model_key ?? "").trim() || "(empty)";
    byModelKey.set(mk, (byModelKey.get(mk) ?? 0) + 1);

    const rawModel = (r.model ?? "").trim() || "(empty)";
    byRawModel.set(rawModel, (byRawModel.get(rawModel) ?? 0) + 1);

    const sample = TITLE_GROUP_NORMALIZE
      ? normalizeTitleForGroup(r.title)
      : ((r.title ?? "").trim().slice(0, TITLE_PREFIX_LEN) || "(null)");
    byTitleSample.set(sample, (byTitleSample.get(sample) ?? 0) + 1);
  }

  const byModelKeySorted: ModelVariantGroup[] = Array.from(byModelKey.entries())
    .map(([model_key, count]) => ({ model_key, count }))
    .sort((a, b) => b.count - a.count);

  const byRawModelSorted: RawModelGroup[] = Array.from(byRawModel.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  const byTitleSampleSorted: TitleSampleGroup[] = Array.from(byTitleSample.entries())
    .map(([titleSample, count]) => ({ titleSample, count }))
    .sort((a, b) => b.count - a.count);

  const mainModelKeyCount = byModelKey.get(mainModelKey) ?? 0;
  const otherModelKeys = byModelKeySorted.filter((x) => x.model_key !== mainModelKey);
  const otherVariantsCount = totalRows - mainModelKeyCount;

  return {
    source,
    brandFilter: brand,
    modelFilter: model,
    totalRows,
    byModelKey: byModelKeySorted,
    byRawModel: byRawModelSorted,
    byTitleSample: byTitleSampleSorted,
    mainModelKey,
    mainModelKeyCount,
    otherVariantsCount,
    otherModelKeys,
  };
}

function printResult(r: AuditModelVariantsResult): void {
  console.log("\n--- Audit model variants ---");
  console.log(`source=${r.source} brand=${r.brandFilter} model=${r.modelFilter}`);
  console.log(`(rows where brand→${r.brandFilter} and model_key or model contains "${r.modelFilter}")`);
  console.log(`total_rows_matching=${r.totalRows}`);
  console.log(`main_model_key=${r.mainModelKey} count=${r.mainModelKeyCount}`);
  console.log(`other_variants_count=${r.otherVariantsCount}`);

  console.log("\n--- model_key | count ---");
  for (const x of r.byModelKey) {
    console.log(`${x.model_key}\t${x.count}`);
  }

  console.log("\n--- model (raw) | count ---");
  for (const x of r.byRawModel) {
    console.log(`${x.model}\t${x.count}`);
  }

  console.log("\n--- title sample (normalized prefix) | count ---");
  const topTitles = r.byTitleSample.slice(0, 30);
  for (const x of topTitles) {
    console.log(`${x.titleSample}\t${x.count}`);
  }

  console.log("\n--- Summary ---");
  console.log(`Pure ${r.mainModelKey}: ${r.mainModelKeyCount} rows`);
  console.log(`Other variants: ${r.otherVariantsCount} rows across ${r.otherModelKeys.length} model_key(s)`);
  if (r.otherModelKeys.length > 0) {
    console.log("Variant model_keys:");
    for (const x of r.otherModelKeys) {
      console.log(`  ${x.model_key}: ${x.count}`);
    }
  }

  console.log("\n--- Quick SQL (manual check in DB) ---");
  console.log(`-- model_key | count:`);
  console.log(`SELECT model_key, COUNT(*) FROM market_observations WHERE source = '${r.source}' AND (model_key ILIKE '%${r.modelFilter}%' OR model ILIKE '%${r.modelFilter}%') GROUP BY model_key ORDER BY COUNT(*) DESC;`);
  console.log(`-- model (raw) | count:`);
  console.log(`SELECT model, COUNT(*) FROM market_observations WHERE source = '${r.source}' AND (model_key ILIKE '%${r.modelFilter}%' OR model ILIKE '%${r.modelFilter}%') GROUP BY model ORDER BY COUNT(*) DESC;`);
}

async function main(): Promise<void> {
  const { source, brand, model } = parseArgs();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await auditModelVariants(supabase, source, brand, model);
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
