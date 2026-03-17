/**
 * TIPCARS ingest source – jednotný flow: fetch list → parse → fetch detail → merge → normalize → saveObservations → quality summary.
 * Model-specific režim: fetch více stránek, po normalizaci filtrovat podle model_key (fallback – TipCars nemá server-side filtr po modelu).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchTipcarsListings,
  fetchTipcarsModelListings,
} from "@/lib/ingest/tipcars/fetchTipcarsListings";
import { parseTipcarsListPages } from "@/lib/ingest/tipcars/parseTipcarsListing";
import { enrichTipcarsListings } from "@/lib/ingest/tipcars/enrichTipcarsListings";
import { mapTipcarsToObservation } from "@/lib/ingest/tipcars/mapTipcarsToObservation";
import { normalizeObservation } from "@/lib/ingest/normalizeObservation";
import { saveObservations } from "@/lib/ingest/saveObservations";
import {
  getIngestQualitySummary,
  logIngestQualitySummary,
  getIngestQualitySummaryForModelKey,
  logModelKeyQualitySummary,
} from "@/lib/ingest/ingestQualitySummary";
import { buildModelKey } from "@/lib/ingest/textNormalize";
import { isObservationPricingReady } from "@/lib/ingest/pricingReady";
import type { IngestOptions } from "@/lib/ingest/runIngest";

export type IngestResult = {
  source: string;
  saved: number;
  inserted: number;
  updated: number;
  errors: string[];
  funnel?: Record<string, number | string | boolean | null | undefined>;
};

const DEFAULT_PAGES = 3;
const MIN_PRICE_CZK = 10_000;

function countMissing<T>(
  list: T[],
  get: (x: T) => unknown
): number {
  return list.filter((x) => get(x) == null || get(x) === "").length;
}

/**
 * Run TIPCARS ingest: fetch list → parse → fetch detail per listing → merge → normalize → save.
 * Při options.brand: deep mode – fetch options.pages stránek, po normalizaci filtrovat podle model_key (fallback).
 */
export async function runTipcarsIngest(
  supabase: SupabaseClient,
  options?: IngestOptions
): Promise<IngestResult> {
  const errors: string[] = [];
  const pagesRequested = options?.pages ?? DEFAULT_PAGES;
  const isDeep = options?.brand != null && options.brand !== "";
  const targetModelKey =
    isDeep && options?.model
      ? buildModelKey(options.brand!, options.model)
      : null;

  if (isDeep && targetModelKey) {
    console.log(
      "[ingest][tipcars] model-specific: fetch",
      pagesRequested,
      "pages, filter by model_key before save (no server-side filter)"
    );
  }

  // Fetch layer (list pages)
  let fetchResult:
    | {
        htmlPerPage: string[];
        urls: string[];
        errors: string[];
      };

  if (isDeep && options?.brand && options?.model) {
    // Brand+model specifická URL: /skoda-octavia/ojete/
    fetchResult = await fetchTipcarsModelListings({
      brand: options.brand,
      model: options.model,
      pages: pagesRequested,
    });
  } else {
    // Globální nebo brand-only fallback
    const initial = await fetchTipcarsListings({
      pages: pagesRequested,
      brand: options?.brand ?? undefined,
    });
    if (
      isDeep &&
      initial.htmlPerPage.length > 0 &&
      initial.htmlPerPage.every((h) => h.length < 1000)
    ) {
      console.log("[ingest][tipcars] brand URL failed, fallback to global");
      fetchResult = await fetchTipcarsListings({ pages: pagesRequested });
    } else {
      fetchResult = initial;
    }
  }

  const { htmlPerPage, errors: fetchErrors } = fetchResult;
  errors.push(...fetchErrors);

  if (htmlPerPage.length === 0) {
    console.warn("[ingest][tipcars] no HTML fetched, skipping");
    const quality = await getIngestQualitySummary(supabase, "tipcars");
    logIngestQualitySummary(quality);
    return { source: "tipcars", saved: 0, inserted: 0, updated: 0, errors };
  }

  // Parsing layer (list only)
  const parsed = parseTipcarsListPages(htmlPerPage);
  const totalListingsFound = parsed.length;
  console.log(`[ingest][tipcars] total_listings_found=${totalListingsFound}`);

  // Filter: only listings with minimum price and brand+model
  const filtered = parsed.filter(
    (p) =>
      p.price_czk != null &&
      p.price_czk >= MIN_PRICE_CZK &&
      (p.brand ?? "").trim() !== "" &&
      (p.model ?? "").trim() !== ""
  );

  // Before-enrichment missing counts (for comparison)
  const beforeMileageMissing = countMissing(filtered, (p) => p.mileage_km);
  const beforeEngineMissing = countMissing(
    filtered,
    (p) => p.engine_raw ?? p.engine_trim
  );

  // Detail enrichment: fetch each detail page, parse, merge (detail overrides list)
  const { enriched, stats } = await enrichTipcarsListings(filtered, 5);
  console.log(`[ingest][tipcars] detail_fetch_attempted=${stats.detail_fetch_attempted}`);
  console.log(`[ingest][tipcars] detail_fetch_succeeded=${stats.detail_fetch_succeeded}`);
  console.log(`[ingest][tipcars] detail_fetch_failed=${stats.detail_fetch_failed}`);
  console.log(`[ingest][tipcars] enriched_mileage_count=${stats.enriched_mileage_count}`);
  console.log(`[ingest][tipcars] enriched_engine_count=${stats.enriched_engine_count}`);

  const afterMileageMissing = countMissing(enriched, (p) => p.mileage_km);
  const afterEngineMissing = countMissing(
    enriched,
    (p) => p.engine_raw ?? p.engine_trim
  );
  console.log(
    `[ingest][tipcars] mileage_missing before=${beforeMileageMissing} after=${afterMileageMissing}`
  );
  console.log(
    `[ingest][tipcars] engine_missing before=${beforeEngineMissing} after=${afterEngineMissing}`
  );

  // Normalization layer: map enriched listing → normalize
  const rawObservations = enriched.map(mapTipcarsToObservation);
  let observations = rawObservations
    .map(normalizeObservation)
    .filter((o): o is NonNullable<typeof o> => o != null);

  const totalEnriched = observations.length;
  if (targetModelKey) {
    const beforeFilter = observations.length;
    observations = observations.filter((o) => o.model_key === targetModelKey);
    console.log(
      `[ingest][tipcars] filter by model_key=${targetModelKey} before=${beforeFilter} after=${observations.length}`
    );
  }

  const skipped = rawObservations.length - totalEnriched;
  if (skipped > 0) {
    errors.push(`tipcars: ${skipped} rows failed normalization`);
  }

  // Save (shared logic)
  const { saved, skipped: saveSkipped, inserted, updated } = await saveObservations(
    supabase,
    observations
  );
  if (saveSkipped > 0) {
    errors.push(`tipcars: ${saveSkipped} rows skipped by saveObservations`);
  }

  let pricing_ready_count = 0;
  let missing_mileage_count = 0;
  let missing_engine_key_count = 0;
  for (const o of observations) {
    if (isObservationPricingReady(o)) pricing_ready_count += 1;
    if (o.mileage_km == null) missing_mileage_count += 1;
    if (o.engine_key == null || o.engine_key === "") missing_engine_key_count += 1;
  }

  const funnel =
    isDeep && targetModelKey
      ? {
          source: "tipcars",
          brand: options!.brand,
          model: options!.model ?? "(all)",
          model_key_filter: targetModelKey,
          pages_requested: pagesRequested,
          total_listings_found: totalListingsFound,
          total_parsed: filtered.length,
          total_enriched: totalEnriched,
          total_after_filter: observations.length,
          unique_source_listing_ids_in_run: observations.length,
          existing_before_save: updated,
          inserted,
          updated,
          total_saved: saved,
          pricing_ready_count,
          missing_mileage_count,
          missing_engine_key_count,
        }
      : undefined;

  if (funnel) {
    console.log("[ingest][tipcars][funnel]", JSON.stringify(funnel, null, 0));
  }

  console.log(
    `[ingest][tipcars] total_parsed=${totalListingsFound} total_enriched=${enriched.length} saved=${saved} inserted=${inserted} updated=${updated}`
  );

  if (targetModelKey) {
    const modelQuality = await getIngestQualitySummaryForModelKey(
      supabase,
      "tipcars",
      targetModelKey
    );
    logModelKeyQualitySummary(modelQuality);
  } else {
    const quality = await getIngestQualitySummary(supabase, "tipcars");
    logIngestQualitySummary(quality);
  }

  return {
    source: "tipcars",
    saved,
    inserted,
    updated,
    errors,
    funnel,
  };
}
