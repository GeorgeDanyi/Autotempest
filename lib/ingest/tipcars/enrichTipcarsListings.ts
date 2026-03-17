/**
 * Detail-page enrichment – pro každý listing stáhne detail, sparsuje a sloučí data.
 * Pravidlo: detail má vyšší prioritu; pokud detail vrátí hodnotu, přepíše list hodnotu.
 */

import { fetchTipcarsDetail } from "./fetchTipcarsDetail";
import { parseTipcarsDetail } from "./parseTipcarsDetail";
import type { TipcarsParsedListing } from "./parseTipcarsListing";

export type EnrichTipcarsStats = {
  total_listings_found: number;
  detail_fetch_attempted: number;
  detail_fetch_succeeded: number;
  detail_fetch_failed: number;
  enriched_mileage_count: number;
  enriched_engine_count: number;
  enriched_year_count: number;
  enriched_fuel_count: number;
  enriched_transmission_count: number;
};

/**
 * Sloučí data z detailu do listingu. Detail má prioritu – přepisuje jen když má hodnotu.
 */
function mergeDetailIntoListing(
  list: TipcarsParsedListing,
  detail: import("./parseTipcarsDetail").TipcarsDetailData
): TipcarsParsedListing {
  return {
    ...list,
    mileage_km: detail.mileage_km ?? list.mileage_km,
    year: detail.year ?? list.year,
    fuel: detail.fuel ?? list.fuel,
    transmission: detail.transmission ?? list.transmission,
    power_kw: detail.power_kw ?? list.power_kw,
    engine_raw: detail.engine_raw ?? list.engine_raw,
    engine_trim: list.engine_trim,
    body_type: detail.body_type ?? list.body_type,
    location: detail.location ?? list.location,
    title: detail.title ?? list.title,
  };
}

/**
 * Pro každý listing stáhne detail stránku, sparsuje a sloučí.
 * Vrací obohacené listy a statistiky pro logging.
 */
export async function enrichTipcarsListings(
  listings: TipcarsParsedListing[],
  concurrency: number = 5
): Promise<{
  enriched: TipcarsParsedListing[];
  stats: EnrichTipcarsStats;
}> {
  const stats: EnrichTipcarsStats = {
    total_listings_found: listings.length,
    detail_fetch_attempted: 0,
    detail_fetch_succeeded: 0,
    detail_fetch_failed: 0,
    enriched_mileage_count: 0,
    enriched_engine_count: 0,
    enriched_year_count: 0,
    enriched_fuel_count: 0,
    enriched_transmission_count: 0,
  };

  const enriched: TipcarsParsedListing[] = new Array(listings.length);
  const batchSize = Math.max(1, concurrency);
  let processed = 0;

  for (let i = 0; i < listings.length; i += batchSize) {
    const tasks: Promise<void>[] = [];
    for (let j = 0; j < batchSize; j++) {
      const idx = i + j;
      if (idx >= listings.length) break;
      const list = listings[idx];
      tasks.push(
        (async () => {
          if (!list.url) {
            enriched[idx] = list;
            return;
          }

          stats.detail_fetch_attempted += 1;
          const fetchResult = await fetchTipcarsDetail(list.url);

          if (!fetchResult.ok) {
            stats.detail_fetch_failed += 1;
            enriched[idx] = list;
            return;
          }
          stats.detail_fetch_succeeded += 1;

          const detailData = parseTipcarsDetail(fetchResult.html);
          const merged = mergeDetailIntoListing(list, detailData);
          enriched[idx] = merged;

          if (list.mileage_km == null && merged.mileage_km != null)
            stats.enriched_mileage_count += 1;
          if (list.engine_raw == null && merged.engine_raw != null)
            stats.enriched_engine_count += 1;
          if (list.year == null && merged.year != null)
            stats.enriched_year_count += 1;
          if (list.fuel == null && merged.fuel != null)
            stats.enriched_fuel_count += 1;
          if (list.transmission == null && merged.transmission != null)
            stats.enriched_transmission_count += 1;
        })(),
      );
    }
    await Promise.all(tasks);
    processed = Math.min(processed + tasks.length, listings.length);
    if (processed > 0 && processed % 50 === 0) {
      console.log(
        `[ingest][tipcars] enriched ${processed}/${listings.length}`,
      );
    }
  }

  return { enriched, stats };
}
