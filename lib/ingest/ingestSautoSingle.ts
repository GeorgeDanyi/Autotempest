import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  parseSautoList,
  type SautoParsedListing,
} from "@/lib/ingest/sauto/parseListPage";
import { buildModelKey } from "@/lib/ingest/textNormalize";
import { detectEngineKey } from "@/lib/ingest/detectEngineKey";
import { normalizeModelKey } from "@/lib/cars/normalizeModel";
import { normalizeBrandForDb } from "@/lib/analyze/normalizeBrandKey";

const SAUTO_URL = "https://www.sauto.cz/inzerce/osobni";
const DEFAULT_PAGES = 3;

let debugFailedRowsLogged = 0;

export type MarketObservationInsert = {
  source: "sauto";
  brand: string;
  model: string;
  model_key: string;
  trim: string | null;
  fuel: string | null;
  transmission: string | null;
  /** Normalized engine/drivetrain key derived from listing text. */
  engine_key?: string | null;
  /** Raw text použité pro detekci motoru (title + brand + model + fuel + transmission). */
  engine_raw?: string | null;
  year: number | null;
  mileage_km: number | null;
  price_czk: number;
  region: string | null;
  /** Canonical location (prefer over region). */
  location?: string | null;
  source_url?: string | null;
  title?: string | null;
  source_listing_id: string;
  observed_at?: string;
  observed_day?: string;
  last_seen_at?: string;
  active?: boolean;
};

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AutotempestBot/0.1 (contact: dev@autotempest.local)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchSautoPages(params: {
  pages: number;
  brand?: string | null;
  model?: string | null;
}): Promise<{
  allParsed: SautoParsedListing[];
  pagesFetched: number;
  errors: string[];
  timedOut: boolean;
}> {
  const { pages, brand, model } = params;

  const pagesClamped = Number.isFinite(pages) && pages > 0 ? pages : DEFAULT_PAGES;

  const baseUrl = new URL(SAUTO_URL);
  if (brand) baseUrl.searchParams.set("znacka", brand);
  if (model) baseUrl.searchParams.set("model", model);

  const urls: string[] = [];
  for (let i = 0; i < pagesClamped; i++) {
    const urlObj = new URL(baseUrl);
    if (i > 0) {
      urlObj.searchParams.set("page", String(i + 1));
    }
    urls.push(urlObj.toString());
  }

  const allParsed: SautoParsedListing[] = [];
  const errors: string[] = [];
  let pagesFetched = 0;
  let timedOut = false;

  for (const url of urls) {
    try {
      const html = await fetchWithTimeout(url, 10_000);
      const parsedPage = parseSautoList(html);
      allParsed.push(...parsedPage);
      pagesFetched += 1;
    } catch (e: any) {
      const msg = e?.message ?? "fetch failed";
      if (
        e?.name === "AbortError" ||
        (typeof msg === "string" && msg.toLowerCase().includes("aborted"))
      ) {
        timedOut = true;
      }
      errors.push(`fetch:${url}:${msg}`);
    }
  }

  return { allParsed, pagesFetched, errors, timedOut };
}

/** Start of today UTC for same-day duplicate check */
function startOfTodayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString();
}

/** Sestaví raw text pro detekci motoru (stejný vstup jako pro detectEngineKey). */
function buildEngineRawFromListing(listing: SautoParsedListing): string | null {
  const parts: string[] = [];
  if (listing.title) parts.push(listing.title);
  if (listing.brand) parts.push(listing.brand);
  if (listing.model) parts.push(listing.model);
  if (listing.fuel) parts.push(listing.fuel);
  if (listing.transmission) parts.push(listing.transmission);
  const text = parts.join(" ").trim();
  return text || null;
}

/** Derive engine_key from SAUTO listing fields using detectEngineKey helper. */
function deriveEngineKeyFromListing(listing: SautoParsedListing): string | null {
  const text = buildEngineRawFromListing(listing);
  if (!text) return null;

  const key = detectEngineKey(text);
  if (key) {
    console.log("[engineDetected]", key);
  }
  return key;
}

/** Idempotent row upsert: exists → update last_seen_at only; else check secondary dup; else insert. */
export async function upsertMarketObservationRow(
  supabase: SupabaseClient,
  row: MarketObservationInsert,
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const source = row.source;
  const source_listing_id = row.source_listing_id;
  const now = new Date().toISOString();
  const rowWithTimestamps: MarketObservationInsert = {
    ...row,
    observed_at: row.observed_at ?? now,
    observed_day: row.observed_day ?? now.slice(0, 10),
    last_seen_at: now,
    active: true,
  };

  const { data: existing } = await supabase
    .from("market_observations")
    .select("id")
    .eq("source", source)
    .eq("source_listing_id", source_listing_id)
    .maybeSingle();

  if (existing) {
    const updatePayload: { last_seen_at: string; active: boolean; engine_raw?: string | null } = {
      last_seen_at: now,
      active: true,
    };
    if (row.engine_raw !== undefined) updatePayload.engine_raw = row.engine_raw ?? null;
    const { error: updateError } = await supabase
      .from("market_observations")
      .update(updatePayload)
      .eq("source", source)
      .eq("source_listing_id", source_listing_id);
    if (updateError) {
      const msg = updateError.message ?? "update failed";
      console.error("[ingestError]", {
        source_listing_id,
        engine_key: row.engine_key ?? null,
        error: msg,
      });
      return { ok: false, error: msg };
    }
    return { ok: true };
  }

  const todayStart = startOfTodayIso();
  let sameDayQuery = supabase
    .from("market_observations")
    .select("id, source_listing_id")
    .eq("brand", row.brand)
    .eq("model", row.model)
    .eq("price_czk", row.price_czk)
    .gte("last_seen_at", todayStart)
    .limit(1);
  sameDayQuery =
    row.year != null
      ? sameDayQuery.eq("year", row.year)
      : sameDayQuery.is("year", null);
  sameDayQuery =
    row.mileage_km != null
      ? sameDayQuery.eq("mileage_km", row.mileage_km)
      : sameDayQuery.is("mileage_km", null);
  const { data: sameDayMatch } = await sameDayQuery.maybeSingle();

  if (sameDayMatch) {
    console.error(`[duplicateDetected] source_listing_id=${source_listing_id}`);
    return {
      ok: false,
      error: "Duplicate by content (same brand/model/year/mileage/price today)",
      skipped: true,
    };
  }

  const { error: insertError } = await supabase
    .from("market_observations")
    .insert(rowWithTimestamps);

  if (insertError) {
    const msg = insertError.message ?? "insert failed";
    console.error("[ingestError]", {
      source_listing_id,
      engine_key: row.engine_key ?? null,
      error: msg,
    });
    if (process.env.DEBUG_INGEST === "1" && debugFailedRowsLogged < 3) {
      console.error("[ingestErrorRow]", {
        source_listing_id,
        row: rowWithTimestamps,
      });
      debugFailedRowsLogged += 1;
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function upsertMarketObservationFromParsedListing(
  supabase: SupabaseClient,
  listing: SautoParsedListing,
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const source_listing_id = listing.source_listing_id;
  if (!source_listing_id) {
    return {
      ok: false,
      error: "missing source_listing_id",
      skipped: true,
    };
  }
  if (
    !listing.brand ||
    !listing.model ||
    typeof listing.price_czk !== "number" ||
    !Number.isFinite(listing.price_czk)
  ) {
    return {
      ok: false,
      error: "Parsed listing missing required fields",
      skipped: true,
    };
  }

  const now = new Date().toISOString();
  const model_key =
    normalizeModelKey({
      brand: listing.brand,
      model: listing.model,
      trim: listing.title ?? null,
    }) ?? buildModelKey(listing.brand, listing.model);
  const brandDisplay = normalizeBrandForDb(listing.brand) ?? listing.brand;
  const row: MarketObservationInsert = {
    source: "sauto",
    brand: brandDisplay,
    model: listing.model,
    model_key,
    trim: listing.title ?? null,
    fuel: listing.fuel ?? null,
    transmission: listing.transmission ?? null,
    engine_key: deriveEngineKeyFromListing(listing),
    engine_raw: buildEngineRawFromListing(listing),
    year: listing.year ?? null,
    mileage_km: listing.mileage_km ?? null,
    price_czk: listing.price_czk as number,
    region: listing.region ?? null,
    location: listing.region ?? null,
    source_url: listing.url ?? null,
    title: listing.title ?? null,
    source_listing_id,
    observed_at: now,
    observed_day: now.slice(0, 10),
    last_seen_at: now,
    active: true,
  };
  return upsertMarketObservationRow(supabase, row);
}

export async function ingestSautoSingle(params: {
  source_listing_id: string;
  pages?: number;
  brand?: string | null;
  model?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    source_listing_id,
    pages = DEFAULT_PAGES,
    brand = null,
    model = null,
  } = params;

  if (!source_listing_id) {
    return { ok: false, error: "source_listing_id required" };
  }

  const supabase = getSupabaseAdmin();
  const { allParsed, timedOut } = await fetchSautoPages({ pages, brand, model });

  const listing = allParsed.find(
    (p) => p.source_listing_id === source_listing_id,
  );

  if (!listing) {
    if (timedOut) {
      return { ok: false, error: "timeout while fetching SAUTO" };
    }
    return { ok: false, error: "Listing not found on SAUTO list pages" };
  }

  const result = await upsertMarketObservationFromParsedListing(
    supabase,
    listing,
  );
  if (result.ok) return { ok: true };
  if (result.skipped) return { ok: false, error: result.error };
  return { ok: false, error: result.error };
}

export async function ingestSautoPages(params: {
  pagesRequested: number;
  brand: string | null;
  model: string | null;
}): Promise<{
  ok: true;
  pagesRequested: number;
  pagesFetched: number;
  parsedTotal: number;
  parsedUnique: number;
  parsed: number;
  prepared: number;
  insertedApprox: number;
  rebuilt: {
    model_key: string;
    bucket: string;
    ok: boolean;
    sample_size?: number;
    upserted?: number;
  }[];
  target: { brand: string | null; model: string | null; pages: number };
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();

  const pagesRequestedClamped =
    Number.isFinite(params.pagesRequested) && params.pagesRequested > 0
      ? params.pagesRequested
      : DEFAULT_PAGES;

  const { allParsed, pagesFetched, errors } = await fetchSautoPages({
    pages: pagesRequestedClamped,
    brand: params.brand,
    model: params.model,
  });

  // deduplikace podle source_listing_id
  const bySourceId = new Map<string, SautoParsedListing>();
  for (const p of allParsed) {
    const id = p.source_listing_id;
    if (!id) continue;
    if (!bySourceId.has(id)) {
      bySourceId.set(id, p);
    }
  }
  const parsedUnique = Array.from(bySourceId.values());

  // filter (MVP: jen ty, co mají brand+model+price)
  const filtered = parsedUnique.filter(
    (p) =>
      !!p.brand &&
      !!p.model &&
      typeof p.price_czk === "number" &&
      Number.isFinite(p.price_czk),
  );

  let insertedApprox = 0;

  for (let i = 0; i < filtered.length; i++) {
    const result = await upsertMarketObservationFromParsedListing(
      supabase,
      filtered[i],
    );
    if (result.ok) insertedApprox += 1;
    else if (!result.skipped) errors.push(result.error);
    if (i > 0 && i % 50 === 0) {
      console.error(`[ingestSautoPages] progress ${i}/${filtered.length}`);
    }

  }

  const uniqueModelKeys = Array.from(
    new Set(
      filtered.map((p) =>
        normalizeModelKey({
          brand: p.brand,
          model: p.model,
          trim: p.title ?? null,
        }) ?? buildModelKey(p.brand!, p.model!),
      ),
    ),
  ).slice(0, 10);

  const perModelRebuildResults: {
    model_key: string;
    bucket: string;
    ok: boolean;
    sample_size?: number;
    upserted?: number;
  }[] = [];

  if (uniqueModelKeys.length > 0) {
    try {
      // Lazy import to avoid circular deps issues if any
      const { rebuildPriceIndex } = await import(
        "@/lib/pricing/rebuildPriceIndex"
      );
      const { rebuildModelIndex } = await import(
        "@/lib/pricing/rebuildModelIndex"
      );

      try {
        await rebuildPriceIndex(supabase, { modelKeys: uniqueModelKeys });
      } catch (e: any) {
        const msg = e?.message ?? "price index rebuild failed";
        errors.push(`price_index_rebuild:${msg}`);
      }

      const modelKeysForRebuild = Array.from(
        new Set(
          filtered.map((p) =>
            normalizeModelKey({
              brand: p.brand,
              model: p.model,
              trim: p.title ?? null,
            }) ?? buildModelKey(p.brand!, p.model!),
          ),
        ),
      ).slice(0, 5);

      const bucketsForRebuild: string[] = [
        "all",
        "year_2016_plus",
        "year_2016_plus__mileage_0_50k",
        "year_2016_plus__mileage_50_100k",
        "year_2016_plus__mileage_100_150k",
        "year_2016_plus__mileage_150_200k",
        "year_2016_plus__mileage_200_250k",
        "year_2016_plus__mileage_250k_plus",
      ];

      for (const model_key of modelKeysForRebuild) {
        for (const bucket of bucketsForRebuild) {
          try {
            const res = await rebuildModelIndex({ model_key, bucket });
            if (!res.ok) {
              errors.push(
                `rebuild_model_index:${model_key}:${bucket}:${res.error}`,
              );
              perModelRebuildResults.push({ model_key, bucket, ok: false });
            } else {
              perModelRebuildResults.push({
                model_key,
                bucket,
                ok: true,
                sample_size: res.sample_size,
                upserted: res.upserted,
              });
            }
          } catch (e: any) {
            const msg = e?.message ?? "rebuild model index failed";
            errors.push(
              `rebuild_model_index:${model_key}:${bucket}:${msg}`,
            );
            perModelRebuildResults.push({ model_key, bucket, ok: false });
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? "pricing rebuild imports failed";
      errors.push(msg);
    }
  }

  return {
    ok: true,
    pagesRequested: pagesRequestedClamped,
    pagesFetched,
    parsedTotal: allParsed.length,
    parsedUnique: parsedUnique.length,
    parsed: parsedUnique.length,
    prepared: parsedUnique.length,
    insertedApprox,
    rebuilt: perModelRebuildResults,
    target: {
      brand: params.brand,
      model: params.model,
      pages: pagesRequestedClamped,
    },
    errors,
  };
}

// --- CLI runner (runs only when executed directly) ---
function printHelp(): void {
  console.log(`
ingestSautoSingle – ingest one SAUTO listing by id, bulk ingest, or list parsed listings.

Usage:
  npx tsx ./lib/ingest/ingestSautoSingle.ts --id <source_listing_id> [options]
  npx tsx ./lib/ingest/ingestSautoSingle.ts --bulk <N> [options]
  npx tsx ./lib/ingest/ingestSautoSingle.ts --list [options]

Modes:
  --id <source_listing_id>   Ingest one listing by id. If both --id and --list/--bulk, --id wins.
  --bulk <N>                 Bulk mode: fetch list pages once, then ingest first N unique listings.
  --list                     List mode: print parsed listings from list pages (no DB write).

Optional (filters for list pages):
  --pages <number>          Number of list pages to fetch (default: 3).
  --brand <string>          Filter by brand (SAUTO query param "znacka").
  --model <string>          Filter by model (SAUTO query param "model").

Other:
  --help                     Show this help and exit.

Examples:
  npx tsx ./lib/ingest/ingestSautoSingle.ts --id 12345678
  npx tsx ./lib/ingest/ingestSautoSingle.ts --bulk 200 --pages 10
  npx tsx ./lib/ingest/ingestSautoSingle.ts --bulk 50 --pages 5 --brand skoda --model octavia
  npx tsx ./lib/ingest/ingestSautoSingle.ts --list --pages 2
`);
}

function parseArgv(args: string[]): {
  id: string | null;
  bulk: number | null;
  list: boolean;
  pages: number;
  brand: string | null;
  model: string | null;
  help: boolean;
} {
  let id: string | null = null;
  let bulk: number | null = null;
  let list = false;
  let pages = 3;
  let brand: string | null = null;
  let model: string | null = null;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--list") {
      list = true;
    } else if (arg === "--bulk" && args[i + 1] != null) {
      const n = parseInt(args[i + 1], 10);
      if (Number.isFinite(n) && n > 0) bulk = n;
      i += 1;
    } else if (arg === "--id" && args[i + 1] != null) {
      id = args[i + 1];
      i += 1;
    } else if (arg === "--pages" && args[i + 1] != null) {
      const n = parseInt(args[i + 1], 10);
      if (Number.isFinite(n) && n > 0) pages = n;
      i += 1;
    } else if (arg === "--brand" && args[i + 1] != null) {
      brand = args[i + 1];
      i += 1;
    } else if (arg === "--model" && args[i + 1] != null) {
      model = args[i + 1];
      i += 1;
    }
  }

  return { id, bulk, list, pages, brand, model, help };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { id, bulk, list, pages, brand, model, help } = parseArgv(args);

  if (help) {
    printHelp();
    process.exit(0);
  }

  // --id takes priority (single ingest from list pages: fetch, find by id, upsert)
  if (id && id !== "") {
    console.error("[ingestSautoSingle] start");
    console.error(`[ingestSautoSingle] fetching list pages: ${pages}`);
    console.error(`[ingestSautoSingle] ingesting id: ${id}`);

    const result = await ingestSautoSingle({
      source_listing_id: id,
      pages,
      brand,
      model,
    });

    if (!result.ok) {
      console.error("[ingestSautoSingle] error:", result.error);
      process.exit(1);
    }

    console.error("[ingestSautoSingle] done");
    process.exit(0);
  }

  // --bulk <N>: fetch list pages once, parse, dedupe, upsert first N (list pages only, no detail)
  if (bulk != null && bulk > 0) {
    const { allParsed, pagesFetched, errors: fetchErrors } = await fetchSautoPages({
      pages,
      brand,
      model,
    });

    const byId = new Map<string, SautoParsedListing>();
    for (const p of allParsed) {
      const sid = p.source_listing_id;
      if (sid && !byId.has(sid)) byId.set(sid, p);
    }
    const unique = Array.from(byId.values()).slice(0, bulk);
    let inserted = 0;
    let skippedExisting = 0;

    const supabase = getSupabaseAdmin();
    for (let i = 0; i < unique.length; i++) {
      const result = await upsertMarketObservationFromParsedListing(
        supabase,
        unique[i],
      );
      if (result.ok) inserted += 1;
      else if (result.skipped) skippedExisting += 1;
      if ((i + 1) % 10 === 0) {
        console.error(`[ingestSautoSingle] progress: ${i + 1}/${unique.length}`);
      }
    }

    console.error(`[ingestSautoBulk] pagesFetched=${pagesFetched}`);
    console.error(`[ingestSautoBulk] parsedListings=${unique.length}`);
    console.error(`[ingestSautoBulk] inserted=${inserted}`);
    console.error(`[ingestSautoBulk] skippedExisting=${skippedExisting}`);
    if (fetchErrors.length > 0) {
      console.error(`[ingestSautoBulk] fetchErrors=${fetchErrors.length}`);
    }
    process.exit(0);
  }

  if (list) {
    const { allParsed, pagesFetched, errors, timedOut } = await fetchSautoPages({
      pages,
      brand,
      model,
    });

    for (const p of allParsed) {
      const idPart = p.source_listing_id ?? "";
      const brandModel = [p.brand, p.model].filter(Boolean).join(" ") || "";
      const year = p.year != null ? String(p.year) : "";
      const mileage = p.mileage_km != null ? String(p.mileage_km) : "";
      const price = typeof p.price_czk === "number" ? String(p.price_czk) : "";
      const region = p.region ?? "";
      console.log(`${idPart}\t${brandModel}\t${year}\t${mileage}\t${price}\t${region}`);
    }

    console.error(
      `[ingestSautoSingle] summary: pagesFetched=${pagesFetched} totalListings=${allParsed.length} errorsCount=${errors.length} timedOut=${timedOut}`,
    );
    process.exit(0);
  }

  console.error("[ingestSautoSingle] missing required --id, --bulk <N>, or --list");
  printHelp();
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  main().catch((e: unknown) => {
    console.error("[ingestSautoSingle] error:", e);
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(1);
  });
}

