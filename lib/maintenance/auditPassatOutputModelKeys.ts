/**
 * Cílený audit: kam se ukládají passat listingy (podle raw model/title).
 * 1) Řádky kde model/title/model_key obsahuje "passat" → skupina podle model_key.
 * 2) Řádky kde brand=VW ale model_key != volkswagen_passat (možné špatně rozparsované Passaty).
 *
 * Usage:
 *   npx tsx lib/maintenance/auditPassatOutputModelKeys.ts
 *   npx tsx lib/maintenance/auditPassatOutputModelKeys.ts --source=sauto
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrandKey } from "@/lib/analyze/normalizeBrandKey";

const MAX_ROWS = 50_000;
const SAMPLE_RAW_MODEL = 15;
const SAMPLE_TITLES = 8;

type Row = {
  id: string;
  brand: string | null;
  model: string | null;
  model_key: string | null;
  title: string | null;
};

export type OutputModelKeyGroup = {
  model_key: string;
  count: number;
  raw_models: string[];
  title_samples: string[];
};

export type AuditPassatOutputResult = {
  source: string;
  total_passat_related: number;
  by_output_model_key: OutputModelKeyGroup[];
  vw_non_passat: { count: number; by_model_key: OutputModelKeyGroup[] };
  /** Poslední řádky podle last_seen_at (z posledního ingest běhu). */
  recent_rows: { total: number; by_model_key: OutputModelKeyGroup[] };
};

function parseArgs(): { source: string } {
  const i = process.argv.findIndex((a) => a === "--source" || a.startsWith("--source="));
  if (i === -1) return { source: "sauto" };
  const arg = process.argv[i]!;
  if (arg.startsWith("--source=")) return { source: arg.slice("--source=".length).trim() || "sauto" };
  return { source: process.argv[i + 1]?.trim() || "sauto" };
}

function groupByModelKey(
  rows: Row[],
  sampleRaw: number,
  sampleTitles: number
): OutputModelKeyGroup[] {
  const byModelKey = new Map<
    string,
    { count: number; rawModels: Set<string>; titles: string[] }
  >();
  for (const r of rows) {
    const mk = (r.model_key ?? "").trim() || "(empty)";
    const entry = byModelKey.get(mk);
    const rawModel = (r.model ?? "").trim() || "(null)";
    const titleSample = (r.title ?? "").trim().slice(0, 90) || "(null)";
    if (!entry) {
      byModelKey.set(mk, {
        count: 1,
        rawModels: new Set([rawModel]),
        titles: [titleSample],
      });
    } else {
      entry.count += 1;
      entry.rawModels.add(rawModel);
      if (entry.titles.length < sampleTitles && !entry.titles.includes(titleSample)) {
        entry.titles.push(titleSample);
      }
    }
  }
  return Array.from(byModelKey.entries())
    .map(([model_key, { count, rawModels, titles }]) => ({
      model_key,
      count,
      raw_models: Array.from(rawModels).slice(0, sampleRaw),
      title_samples: titles,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function auditPassatOutputModelKeys(
  supabase: SupabaseClient,
  source: string
): Promise<AuditPassatOutputResult> {
  const pattern = "%passat%";
  const [byModelRes, byTitleRes, byKeyRes, vwRowsRes] = await Promise.all([
    supabase
      .from("market_observations")
      .select("id, brand, model, model_key, title")
      .eq("source", source)
      .ilike("model", pattern)
      .limit(MAX_ROWS),
    supabase
      .from("market_observations")
      .select("id, brand, model, model_key, title")
      .eq("source", source)
      .ilike("title", pattern)
      .limit(MAX_ROWS),
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
      .or("brand.ilike.%volkswagen%,brand.ilike.%vw%")
      .limit(MAX_ROWS),
  ]);

  if (byModelRes.error) throw new Error(byModelRes.error.message);
  if (byTitleRes.error) throw new Error(byTitleRes.error.message);
  if (byKeyRes.error) throw new Error(byKeyRes.error.message);
  if (vwRowsRes.error) throw new Error(vwRowsRes.error.message);

  const seen = new Set<string>();
  const merged: Row[] = [];
  for (const r of [...(byModelRes.data ?? []), ...(byTitleRes.data ?? []), ...(byKeyRes.data ?? [])] as Row[]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  const filtered = merged.filter((r) => {
    const brandKey = normalizeBrandKey(r.brand);
    const mk = (r.model_key ?? "").toLowerCase();
    const raw = (r.model ?? "").toLowerCase();
    const title = (r.title ?? "").toLowerCase();
    const hasPassat = mk.includes("passat") || raw.includes("passat") || title.includes("passat");
    return brandKey === "volkswagen" || hasPassat;
  });

  const by_output_model_key = groupByModelKey(filtered, SAMPLE_RAW_MODEL, SAMPLE_TITLES);

  const vwAll = (vwRowsRes.data ?? []) as Row[];
  const vwNonPassat = vwAll.filter((r) => {
    const brandKey = normalizeBrandKey(r.brand);
    if (brandKey !== "volkswagen") return false;
    const mk = (r.model_key ?? "").trim();
    return mk !== "volkswagen_passat";
  });
  const vw_non_passat_by_key = groupByModelKey(vwNonPassat, SAMPLE_RAW_MODEL, SAMPLE_TITLES);

  const recentRes = await supabase
    .from("market_observations")
    .select("id, brand, model, model_key, title")
    .eq("source", source)
    .order("last_seen_at", { ascending: false })
    .limit(50);
  const recentList = (recentRes.data ?? []) as Row[];
  const recent_by_key = groupByModelKey(recentList, SAMPLE_RAW_MODEL, SAMPLE_TITLES);

  return {
    source,
    total_passat_related: filtered.length,
    by_output_model_key,
    vw_non_passat: {
      count: vwNonPassat.length,
      by_model_key: vw_non_passat_by_key,
    },
    recent_rows: { total: recentList.length, by_model_key: recent_by_key },
  };
}

function printResult(r: AuditPassatOutputResult): void {
  console.log("\n--- Passat output model_key audit (source=" + r.source + ") ---");
  console.log("(1) Rows where model/title/model_key contains 'passat' (or brand=vw): total=" + r.total_passat_related);
  console.log("\n--- model_key | count ---");
  for (const g of r.by_output_model_key) {
    console.log(g.model_key + "\t" + g.count);
  }
  console.log("\n--- Per model_key: raw model values & title samples ---");
  for (const g of r.by_output_model_key) {
    console.log("\n" + g.model_key + " (" + g.count + ")");
    console.log("  raw_models: " + g.raw_models.join(" | "));
    for (const t of g.title_samples) {
      console.log("  title: " + t);
    }
  }

  console.log("\n(2) VW rows that are NOT volkswagen_passat (other VW models): count=" + r.vw_non_passat.count);
  for (const g of r.vw_non_passat.by_model_key.slice(0, 8)) {
    console.log("  " + g.model_key + ": " + g.count);
  }

  console.log("\n(3) Last 50 rows by last_seen_at (from recent ingest): total=" + r.recent_rows.total);
  for (const g of r.recent_rows.by_model_key) {
    console.log("\n" + g.model_key + " (" + g.count + ")");
    console.log("  raw_models: " + g.raw_models.join(" | "));
    for (const t of g.title_samples.slice(0, 4)) {
      console.log("  title: " + t);
    }
  }
}

async function main(): Promise<void> {
  const { source } = parseArgs();
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();
  const result = await auditPassatOutputModelKeys(supabase, source);
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
