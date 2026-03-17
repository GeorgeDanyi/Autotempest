import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SautoParsedListing } from "@/lib/ingest/sauto/parseListPage";
import {
  fetchSautoPages,
  upsertMarketObservationFromParsedListing,
} from "@/lib/ingest/ingestSautoSingle";

/** Značky pro crawl po značkách (--brands). */
export const BRANDS = [
  "skoda",
  "volkswagen",
  "bmw",
  "audi",
  "mercedes-benz",
  "toyota",
  "ford",
  "hyundai",
  "kia",
  "peugeot",
  "renault",
  "volvo",
  "mazda",
  "nissan",
  "honda",
  "seat",
  "opel",
];

/** Models to crawl per brand (znacka=<brand>&model=<model>). */
export const BRAND_MODELS: Record<string, string[]> = {
  skoda: [
    "octavia",
    "superb",
    "fabia",
    "kodiaq",
    "scala",
    "kamiq",
    "karoq",
    "octavia_rs",
    "rapid",
    "enyaq",
    "octavia_combi",
  ],
  volkswagen: [
    "golf",
    "passat",
    "tiguan",
    "polo",
    "touareg",
    "sharan",
    "touran",
    "caddy",
    "t-roc",
    "arteon",
    "id4",
    "id3",
  ],
  bmw: ["3", "5", "x3", "x5", "1", "x1", "2", "4", "7", "m3", "x2", "x6", "i3"],
  audi: ["a3", "a4", "a6", "q5", "q7", "a1", "a5", "a8", "q3", "tt", "q2", "e-tron"],
  "mercedes-benz": ["a", "b", "c", "e", "s", "gla", "glc", "gle", "gls", "cla", "slk"],
  toyota: [
    "corolla",
    "rav4",
    "yaris",
    "c-hr",
    "camry",
    "land-cruiser",
    "prius",
    "auris",
    "hilux",
    "proace",
  ],
  ford: [
    "focus",
    "mondeo",
    "kuga",
    "fiesta",
    "puma",
    "galaxy",
    "s-max",
    "explorer",
    "ranger",
    "transit",
    "tourneo",
    "mustang",
  ],
  hyundai: ["i30", "i20", "tucson", "santa-fe", "ioniq", "kona", "ioniq5", "i10"],
  kia: ["ceed", "sportage", "sorento", "stinger", "niro", "rio", "ev6", "xceed"],
  peugeot: ["208", "308", "3008", "5008", "508"],
  renault: ["clio", "megane", "kadjar", "captur", "scenic"],
  seat: ["ibiza", "leon", "ateca", "arona", "tarraco"],
  opel: ["astra", "insignia", "mokka", "corsa", "grandland"],
  nissan: ["qashqai", "x-trail", "juke", "leaf", "micra"],
  mazda: ["cx-5", "cx-3", "3", "6", "mx-5"],
  honda: ["civic", "cr-v", "hr-v", "jazz", "accord"],
  volvo: ["xc60", "xc90", "v60", "v90", "s60"],
};

function printHelp(): void {
  console.error(`
ingestSautoBulk – fetch SAUTO list pages and upsert into market_observations.

Usage:
  npx tsx ./lib/ingest/ingestSautoBulk.ts --brands [--pages <n>]
  npx tsx ./lib/ingest/ingestSautoBulk.ts --models [--pages <n>]

Options:
  --brands    Fetch list pages per brand (znacka=brand).
  --models    Fetch list pages per brand+model (znacka=brand&model=model). Deeper crawl.
  --pages <n>  Number of list pages per brand or per model (default: 10).

Summary is printed to stderr.

Examples:
  npx tsx ./lib/ingest/ingestSautoBulk.ts --brands --pages 10
  npx tsx ./lib/ingest/ingestSautoBulk.ts --models --pages 10
`);
}

function parseArgv(args: string[]): {
  brands: boolean;
  models: boolean;
  pages: number;
  help: boolean;
} {
  let brands = false;
  let models = false;
  let pages = 10;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--brands") {
      brands = true;
    } else if (arg === "--models") {
      models = true;
    } else if (arg === "--pages" && args[i + 1] != null) {
      const n = parseInt(args[i + 1], 10);
      if (Number.isFinite(n) && n > 0) pages = n;
      i += 1;
    }
  }

  return { brands, models, pages, help };
}

export type RunSautoBulkIngestResult = {
  brandsProcessed: number;
  pagesFetched: number;
  parsedListings: number;
  inserted: number;
  skippedExisting: number;
  errors: number;
};

export type RunSautoBulkIngestModelsResult = {
  brandsProcessed: number;
  modelsProcessed: number;
  pagesFetched: number;
  parsedListings: number;
  inserted: number;
  skippedExisting: number;
  errors: number;
};

/**
 * Pouze fetch + parse (bez zápisu do DB). Vrací deduplikovaný seznam listingů.
 * Používá se v unified ingest flow (map → normalize → saveObservations).
 */
export type RunSautoFetchAndParseResult = {
  brandsProcessed: number;
  pagesFetched: number;
  parsedListings: number;
  uniqueListings: SautoParsedListing[];
  errors: string[];
};

export async function runSautoFetchAndParse(options: {
  brands: boolean;
  models: boolean;
  pages: number;
}): Promise<RunSautoFetchAndParseResult> {
  const { pages, brands, models } = options;
  const allParsed: SautoParsedListing[] = [];
  let pagesFetched = 0;
  const brandsTouched = new Set<string>();
  const errors: string[] = [];

  if (brands) {
    for (const brand of BRANDS) {
      const { allParsed: brandListings, pagesFetched: n, errors: e } =
        await fetchSautoPages({
          pages,
          brand,
        });
      allParsed.push(...brandListings);
      pagesFetched += n;
      brandsTouched.add(brand);
      errors.push(...e);
    }
  }

  if (models) {
    for (const [brand, modelList] of Object.entries(BRAND_MODELS)) {
      for (const model of modelList) {
        const { allParsed: modelListings, pagesFetched: n, errors: e } =
          await fetchSautoPages({
            pages,
            brand,
            model,
          });
        allParsed.push(...modelListings);
        pagesFetched += n;
        brandsTouched.add(brand);
        errors.push(...e);
      }
    }
  }

  const brandsProcessed = brandsTouched.size;

  const byId = new Map<string, SautoParsedListing>();
  for (const p of allParsed) {
    const sid = p.source_listing_id;
    if (sid && !byId.has(sid)) byId.set(sid, p);
  }
  const uniqueListings = Array.from(byId.values());

  return {
    brandsProcessed,
    pagesFetched,
    parsedListings: allParsed.length,
    uniqueListings,
    errors,
  };
}

/** Callable runner for automation/cron. Idempotent (upsert). Používá legacy per-row upsert. */
export async function runSautoBulkIngest(options: {
  brands: boolean;
  pages: number;
}): Promise<RunSautoBulkIngestResult> {
  const supabase = getSupabaseAdmin();
  const { uniqueListings, pagesFetched, parsedListings, brandsProcessed } =
    await runSautoFetchAndParse({ brands: options.brands, models: false, pages: options.pages });

  let inserted = 0;
  let skippedExisting = 0;
  let errors = 0;

  for (let i = 0; i < uniqueListings.length; i++) {
    const result = await upsertMarketObservationFromParsedListing(supabase, uniqueListings[i]);
    if (result.ok) inserted += 1;
    else if (result.skipped) skippedExisting += 1;
    else errors += 1;
  }

  return {
    brandsProcessed,
    pagesFetched,
    parsedListings,
    inserted,
    skippedExisting,
    errors,
  };
}

/** Crawl brand → model → pages; dedupe by source_listing_id; upsert. Idempotent. */
export async function runSautoBulkIngestModels(options: {
  pages: number;
}): Promise<RunSautoBulkIngestModelsResult> {
  const { pages } = options;
  const supabase = getSupabaseAdmin();
  const allParsed: SautoParsedListing[] = [];
  let pagesFetched = 0;
  let brandsProcessed = 0;
  let modelsProcessed = 0;

  for (const [brand, models] of Object.entries(BRAND_MODELS)) {
    for (const model of models) {
      const { allParsed: modelListings, pagesFetched: n } = await fetchSautoPages({
        pages,
        brand,
        model,
      });
      allParsed.push(...modelListings);
      pagesFetched += n;
      modelsProcessed += 1;
    }
    brandsProcessed += 1;
  }

  const byId = new Map<string, SautoParsedListing>();
  for (const p of allParsed) {
    const sid = p.source_listing_id;
    if (sid && !byId.has(sid)) byId.set(sid, p);
  }
  const unique = Array.from(byId.values());
  const parsedListings = unique.length;

  let inserted = 0;
  let skippedExisting = 0;
  let errors = 0;

  for (let i = 0; i < unique.length; i++) {
    const result = await upsertMarketObservationFromParsedListing(
      supabase,
      unique[i],
    );
    if (result.ok) inserted += 1;
    else if (result.skipped) skippedExisting += 1;
    else errors += 1;
  }

  return {
    brandsProcessed,
    modelsProcessed,
    pagesFetched,
    parsedListings,
    inserted,
    skippedExisting,
    errors,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { brands, models, pages, help } = parseArgv(args);

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (models) {
    const result = await runSautoBulkIngestModels({ pages });
    console.error("[ingestSautoBulkModels]");
    console.error(
      `[ingestSautoBulkModels] brandsProcessed=${result.brandsProcessed}`,
    );
    console.error(
      `[ingestSautoBulkModels] modelsProcessed=${result.modelsProcessed}`,
    );
    console.error(
      `[ingestSautoBulkModels] pagesFetched=${result.pagesFetched}`,
    );
    console.error(
      `[ingestSautoBulkModels] parsedListings=${result.parsedListings}`,
    );
    console.error(`[ingestSautoBulkModels] inserted=${result.inserted}`);
    console.error(
      `[ingestSautoBulkModels] skippedExisting=${result.skippedExisting}`,
    );
    console.error(`[ingestSautoBulkModels] errors=${result.errors}`);
    process.exit(0);
  }

  if (!brands) {
    console.error("[ingestSautoBulk] missing --brands or --models");
    printHelp();
    process.exit(1);
  }

  const result = await runSautoBulkIngest({ brands: true, pages });
  console.error("[ingestSautoBulk]");
  console.error(`[ingestSautoBulk] brandsProcessed=${result.brandsProcessed}`);
  console.error(`[ingestSautoBulk] pagesFetched=${result.pagesFetched}`);
  console.error(`[ingestSautoBulk] parsedListings=${result.parsedListings}`);
  console.error(`[ingestSautoBulk] inserted=${result.inserted}`);
  console.error(`[ingestSautoBulk] skippedExisting=${result.skippedExisting}`);
  console.error(`[ingestSautoBulk] errors=${result.errors}`);
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  main().catch((e: unknown) => {
    console.error("[ingestSautoBulk] error:", e);
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(1);
  });
}
