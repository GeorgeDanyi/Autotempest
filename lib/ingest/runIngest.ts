/**
 * Centralizovaný ingest runner – spouští zdroje a poté rebuild price index.
 * Podporuje model-specific deep ingest: --source=sauto --brand=skoda --model=octavia --pages=50
 *
 * Usage:
 *   npm run ingest
 *   npx tsx lib/ingest/runIngest.ts --source=sauto
 *   npx tsx lib/ingest/runIngest.ts --source=sauto --brand=skoda --model=octavia --pages=50
 *   npx tsx lib/ingest/runIngest.ts --source=tipcars --brand=skoda --model=octavia --pages=50
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { getSupabaseAdmin } from "../supabase/admin";
import { rebuildPriceIndex } from "../pricing/rebuildPriceIndex";
import { runSautoIngest } from "./sources/sauto";
import { runTipcarsIngest } from "./sources/tipcars";
import { runSautoBulkIngestModels } from "./ingestSautoBulk";
import {
  getIngestQualitySummaryForModelKey,
  logModelKeyQualitySummary,
} from "./ingestQualitySummary";

const SOURCES = [
  { key: "sauto", run: runSautoIngest },
  { key: "tipcars", run: runTipcarsIngest },
] as const;

export type IngestOptions = {
  brand?: string | null;
  model?: string | null;
  pages?: number;
};

type IngestMode = "brands" | "models" | "deep";

function parseArg(name: string, defaultValue: string | null): string | null {
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return defaultValue;
  const arg = process.argv[i]!;
  if (arg.startsWith(`--${name}=`)) return arg.slice(`--${name}=`.length).trim() || null;
  return process.argv[i + 1]?.trim() || null;
}

function parsePages(defaultPages: number): number {
  const p = parseArg("pages", null);
  if (p == null) return defaultPages;
  const n = parseInt(p, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : defaultPages;
}

function parseMode(): IngestMode {
  const raw = parseArg("mode", null);
  if (raw === "brands" || raw === "models" || raw === "deep") return raw;
  return "models";
}

function parseSourceFilter(): string | null {
  return parseArg("source", null);
}

async function main() {
  const sourceFilter = parseSourceFilter();
  const toRun =
    sourceFilter === null
      ? SOURCES
      : SOURCES.filter((s) => s.key === sourceFilter);

  if (toRun.length === 0) {
    console.error(
      "[ingest] unknown --source=%s; use sauto or tipcars",
      sourceFilter ?? ""
    );
    process.exit(1);
  }

  const options: IngestOptions = {
    brand: parseArg("brand", null),
    model: parseArg("model", null),
    pages: parsePages(10),
  };

  let mode: IngestMode = parseMode();
  const hasDeepBrand = options.brand != null && options.brand !== "";
  if (mode === "models" && hasDeepBrand) {
    // Backwards-compat: pokud je zadán brand (a případně model) bez --mode,
    // považujeme to za deep režim.
    mode = "deep";
  }

  const deepMode = options.brand != null && options.brand !== "";
  if (deepMode) {
    console.log("[ingest] start (deep mode)", {
      source: sourceFilter,
      brand: options.brand,
      model: options.model ?? "(all)",
      pages_requested: options.pages,
    });
  } else {
    console.log("[ingest] start", sourceFilter ? `(source=${sourceFilter})` : "");
  }

  const supabase = getSupabaseAdmin();

  let totalSaved = 0;
  for (const { key, run } of toRun) {
    try {
      if (key === "sauto") {
        if (mode === "deep") {
          const result = await run(supabase, options);
          totalSaved += result.saved;
          if (result.errors.length > 0) {
            console.warn(`[ingest] ${key} warnings:`, result.errors);
          }
          const inserted = "inserted" in result ? result.inserted : 0;
          const updated = "updated" in result ? result.updated : 0;
          if ("funnel" in result && result.funnel) {
            const f = result.funnel as Record<string, unknown>;
            console.log(
              `[ingest] ${key} funnel:`,
              JSON.stringify(f),
            );
          }
          console.log(
            `[ingest] ${key} saved=${result.saved} new=${inserted} updated=${updated}`,
          );
        } else if (mode === "models") {
          const pages = options.pages ?? 10;
          console.log(
            "[ingest] sauto models mode – crawl BRANDS+BRAND_MODELS",
            { pages },
          );
          const result = await runSautoBulkIngestModels({ pages });
          totalSaved += result.inserted;
          console.log(
            "[ingest][sauto][models] brandsProcessed=%d modelsProcessed=%d pagesFetched=%d parsedListings=%d inserted=%d skippedExisting=%d errors=%d",
            result.brandsProcessed,
            result.modelsProcessed,
            result.pagesFetched,
            result.parsedListings,
            result.inserted,
            result.skippedExisting,
            result.errors,
          );
        } else {
          // brands mode – plošný crawl po značkách (bez deep kontextu)
          const shallowOptions: IngestOptions = {
            brand: null,
            model: null,
            pages: options.pages,
          };
          const result = await run(supabase, shallowOptions);
          totalSaved += result.saved;
          if (result.errors.length > 0) {
            console.warn(`[ingest] ${key} warnings:`, result.errors);
          }
          const inserted = "inserted" in result ? result.inserted : 0;
          const updated = "updated" in result ? result.updated : 0;
          if ("funnel" in result && result.funnel) {
            const f = result.funnel as Record<string, unknown>;
            console.log(
              `[ingest] ${key} funnel:`,
              JSON.stringify(f),
            );
          }
          console.log(
            `[igest] ${key} saved=${result.saved} new=${inserted} updated=${updated}`,
          );
        }
      } else {
        const result = await run(supabase, options);
        totalSaved += result.saved;
        if (result.errors.length > 0) {
          console.warn(`[ingest] ${key} warnings:`, result.errors);
        }
        const inserted = "inserted" in result ? result.inserted : 0;
        const updated = "updated" in result ? result.updated : 0;
        if ("funnel" in result && result.funnel) {
          const f = result.funnel as Record<string, unknown>;
          console.log(
            `[ingest] ${key} funnel:`,
            JSON.stringify(f),
          );
        }
        console.log(
          `[ingest] ${key} saved=${result.saved} new=${inserted} updated=${updated}`,
        );
      }
    } catch (e) {
      console.error(`[ingest] ${key} failed:`, e);
    }
  }

  console.log("[ingest] running rebuildPriceIndex…");
  const rebuild = await rebuildPriceIndex(supabase);
  console.log("[ingest] rebuildPriceIndex upserted:", rebuild.upserted);

  const qualityModel = parseArg("quality-model", null);
  if (qualityModel) {
    console.log("[ingest] quality summary for model_key:", qualityModel);
    for (const source of ["sauto", "tipcars"] as const) {
      const q = await getIngestQualitySummaryForModelKey(
        supabase,
        source,
        qualityModel
      );
      logModelKeyQualitySummary(q);
    }
  }

  console.log("[ingest] finish, total saved:", totalSaved);
}

main().catch((e) => {
  console.error("[ingest] fatal:", e);
  process.exit(1);
});
