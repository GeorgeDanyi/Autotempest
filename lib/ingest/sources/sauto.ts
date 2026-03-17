/**
 * SAUTO ingest source – jednotný flow: fetch list → parse → map → normalize → saveObservations → quality summary.
 *
 * Model-specific beta seeding: při deep ingest s explicitním options.brand a options.model se všem
 * observation z tohoto běhu nastaví canonical model_key z kontextu (buildModelKey(brand, model)).
 * Neplatí v běžném plošném ingestu (bez --brand/--model). Pouze pro budování silných modelových segmentů.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSautoPages } from "@/lib/ingest/ingestSautoSingle";
import { runSautoFetchAndParse } from "@/lib/ingest/ingestSautoBulk";
import { mapSautoToObservation } from "@/lib/ingest/sauto/mapSautoToObservation";
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
import { isLikelyCanonicalModelMatch } from "@/lib/cars/isLikelyCanonicalModelMatch";

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

/**
 * A. fetch list pages, B. parse list items, F. normalize, G. saveObservations(), H. quality summary.
 * Při options.brand: fetch pouze znacka(+model), options.pages stránek. Funnel + quality po model_key.
 */
export async function runSautoIngest(
  supabase: SupabaseClient,
  options?: IngestOptions
): Promise<IngestResult> {
  const errors: string[] = [];
  const pagesRequested = options?.pages ?? DEFAULT_PAGES;
  const isDeep = options?.brand != null && options.brand !== "";

  let uniqueListings: Awaited<ReturnType<typeof fetchSautoPages>>["allParsed"];
  let pagesFetched: number;
  /** Pouze v deep mode: počet raw záznamů z fetchu před dedupe (pro diagnostiku duplicit). */
  let rawListingsFromFetch: number | undefined;

  if (isDeep) {
    const { allParsed, pagesFetched: n, errors: fetchErrors } = await fetchSautoPages({
      brand: options.brand!,
      model: options.model ?? null,
      pages: pagesRequested,
    });
    errors.push(...fetchErrors);
    rawListingsFromFetch = allParsed.length;
    const byId = new Map<string, (typeof allParsed)[0]>();
    for (const p of allParsed) {
      if (p.source_listing_id && !byId.has(p.source_listing_id)) byId.set(p.source_listing_id, p);
    }
    uniqueListings = Array.from(byId.values());
    pagesFetched = n;
  } else {
    const result = await runSautoFetchAndParse({ brands: true, models: false, pages: DEFAULT_PAGES });
    uniqueListings = result.uniqueListings;
    pagesFetched = result.pagesFetched;
    errors.push(...result.errors);
  }

  const totalListingsFound = uniqueListings.length;
  const filtered = uniqueListings.filter(
    (p) =>
      p.price_czk != null &&
      p.price_czk >= MIN_PRICE_CZK &&
      (p.brand ?? "").trim() !== "" &&
      (p.model ?? "").trim() !== ""
  );

  const rawObservations = filtered.map(mapSautoToObservation);
  let observations = rawObservations
    .map(normalizeObservation)
    .filter((o): o is NonNullable<typeof o> => o != null);

  let overrideReport: {
    model_key_override_applied: boolean;
    model_key_override_target: string;
    rows_matched_for_override: number;
    rows_rejected_for_override: number;
    rows_receiving_override: number;
    rows_that_would_have_been_elsewhere: number;
  } | undefined;
  if (isDeep && options?.brand && options?.model) {
    const targetModelKey = buildModelKey(options.brand, options.model);
    let rowsMatched = 0;
    let rowsRejected = 0;
    let rowsReceiving = 0;
    let wouldElsewhere = 0;
    const nextObservations = observations.map((o) => {
      const matched = isLikelyCanonicalModelMatch({
        requestedBrand: options.brand!,
        targetModelKey,
        observationBrand: o.brand,
        rawModel: o.model,
        title: o.title,
        normalizedModelKey: o.model_key,
      });
      if (!matched) {
        rowsRejected += 1;
        return o;
      }
      rowsMatched += 1;
      rowsReceiving += 1;
      if (o.model_key !== targetModelKey) wouldElsewhere += 1;
      return { ...o, model_key: targetModelKey };
    });
    observations = nextObservations;
    overrideReport = {
      model_key_override_applied: true,
      model_key_override_target: targetModelKey,
      rows_matched_for_override: rowsMatched,
      rows_rejected_for_override: rowsRejected,
      rows_receiving_override: rowsReceiving,
      rows_that_would_have_been_elsewhere: wouldElsewhere,
    };
  }

  const skippedNorm = rawObservations.length - observations.length;
  if (skippedNorm > 0) {
    errors.push(`sauto: ${skippedNorm} rows failed normalization`);
  }

  const saveResult = await saveObservations(supabase, observations);
  const { saved, skipped: saveSkipped, inserted, updated } = saveResult;
  if (saveSkipped > 0) {
    errors.push(`sauto: ${saveSkipped} rows skipped by saveObservations`);
  }
  if (isDeep && (saveResult.inserted_sample?.length || saveResult.updated_sample?.length)) {
    if (saveResult.inserted_sample?.length)
      console.log("[ingest][sauto] inserted_sample_ids:", saveResult.inserted_sample.slice(0, 10));
    if (saveResult.updated_sample?.length)
      console.log("[ingest][sauto] updated_sample_ids:", saveResult.updated_sample.slice(0, 10));
  }

  let pricing_ready_count = 0;
  let missing_mileage_count = 0;
  let missing_engine_key_count = 0;
  for (const o of observations) {
    if (isObservationPricingReady(o)) pricing_ready_count += 1;
    if (o.mileage_km == null) missing_mileage_count += 1;
    if (o.engine_key == null || o.engine_key === "") missing_engine_key_count += 1;
  }

  const uniqueSourceListingIdsInRun = observations.length;
  const duplicateListingIdsDroppedInRun =
    rawListingsFromFetch != null ? rawListingsFromFetch - uniqueListings.length : 0;

  const funnel = isDeep
    ? {
        source: "sauto",
        brand: options!.brand,
        model: options!.model ?? "(all)",
        pages_requested: pagesRequested,
        pages_fetched: pagesFetched,
        total_listings_found: totalListingsFound,
        raw_listings_from_fetch: rawListingsFromFetch ?? totalListingsFound,
        unique_source_listing_ids_in_run: uniqueSourceListingIdsInRun,
        duplicate_listing_ids_dropped_in_run: duplicateListingIdsDroppedInRun,
        total_parsed: filtered.length,
        total_after_norm: observations.length,
        existing_before_save: updated,
        inserted,
        updated,
        total_saved: saved,
        pricing_ready_count,
        missing_mileage_count,
        missing_engine_key_count,
        ...(overrideReport ?? {}),
      }
    : undefined;

  if (funnel) {
    console.log("[ingest][sauto][funnel]", JSON.stringify(funnel, null, 0));
  }

  console.log(
    `[ingest][sauto] total_parsed=${totalListingsFound} filtered=${filtered.length} saved=${saved} inserted=${inserted} updated=${updated}`
  );

  if (isDeep && options!.model) {
    const targetModelKey = buildModelKey(options!.brand!, options!.model!);
    const modelQuality = await getIngestQualitySummaryForModelKey(
      supabase,
      "sauto",
      targetModelKey
    );
    logModelKeyQualitySummary(modelQuality);
  } else {
    const quality = await getIngestQualitySummary(supabase, "sauto");
    logIngestQualitySummary(quality);
  }

  return {
    source: "sauto",
    saved,
    inserted,
    updated,
    errors,
    funnel,
  };
}
