/**
 * Uložení normalizovaných observations do market_observations.
 * Odfiltruje nevalidní záznamy, provede upsert podle (source, source_listing_id)
 * a vrátí počty.
 *
 * Deduplikace: (source, source_listing_id) je unikátní klíč. Při opakovaném ingestu
 * se záznam aktualizuje (last_seen_at, active, cena, …). first_seen_at se při update
 * nemění (trigger v DB).
 *
 * Schéma: docs/MARKET_OBSERVATIONS_SCHEMA.md, migrace 20250308100000.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedVehicleObservation } from "./types";

/** Mapování na sloupce tabulky market_observations. */
function toDbRow(obs: NormalizedVehicleObservation): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    source: obs.source,
    source_listing_id: obs.source_listing_id,
    source_url: obs.source_url ?? null,
    title: obs.title ?? null,
    model_key: obs.model_key,
    brand: obs.brand ?? null,
    model: obs.model ?? null,
    price_czk: obs.price_czk,
    year: obs.year ?? null,
    mileage_km: obs.mileage_km ?? null,
    fuel: obs.fuel ?? null,
    transmission: obs.transmission ?? null,
    power_kw: obs.power_kw ?? null,
    engine_raw: obs.engine ?? null,
    engine_key: obs.engine_key ?? null,
    body_type: obs.body_type ?? null,
    drivetrain: obs.drivetrain ?? null,
    description: obs.description ?? null,
    location: obs.location ?? null,
    observed_at: obs.observed_at,
    first_seen_at: obs.observed_at,
    last_seen_at: now,
    active: true,
  };
}

export type SaveObservationsResult = {
  saved: number;
  skipped: number;
  inserted: number;
  updated: number;
  /** Sample of source_listing_id that were already in DB (first N, for diagnostics). */
  updated_sample?: string[];
  /** Sample of source_listing_id that were newly inserted (first N, for diagnostics). */
  inserted_sample?: string[];
};

function compositeKey(source: string, sourceListingId: string): string {
  return `${source}\t${sourceListingId}`;
}

/**
 * Přijme pole normalizovaných observations, odfiltruje null/nevalidní,
 * upsertuje do market_observations podle (source, source_listing_id).
 * Při konfliktu aktualizuje všechna pole kromě first_seen_at (zachová trigger).
 * Vrátí saved, skipped, inserted, updated.
 */
export async function saveObservations(
  supabase: SupabaseClient,
  observations: (NormalizedVehicleObservation | null)[]
): Promise<SaveObservationsResult> {
  const valid = observations.filter(
    (o): o is NormalizedVehicleObservation => o != null
  );
  const skipped = observations.length - valid.length;

  const SAMPLE_SIZE = 10;
  if (valid.length === 0) {
    return { saved: 0, skipped, inserted: 0, updated: 0 };
  }

  const rows = valid.map(toDbRow);

  // Zjistit, které (source, source_listing_id) už v DB existují (pro inserted/updated).
  const existingSet = new Set<string>();
  const bySource = new Map<string, string[]>();
  for (const o of valid) {
    const key = compositeKey(o.source, o.source_listing_id);
    if (!bySource.has(o.source)) bySource.set(o.source, []);
    bySource.get(o.source)!.push(o.source_listing_id);
  }
  for (const [source, ids] of bySource) {
    const uniqueIds = [...new Set(ids)];
    const { data: existingRows } = await supabase
      .from("market_observations")
      .select("source_listing_id")
      .eq("source", source)
      .in("source_listing_id", uniqueIds);
    for (const row of existingRows ?? []) {
      const r = row as { source_listing_id: string };
      existingSet.add(compositeKey(source, r.source_listing_id));
    }
  }

  const { error } = await supabase
    .from("market_observations")
    .upsert(rows, {
      onConflict: "source,source_listing_id",
    });

  if (!error) {
    let inserted = 0;
    let updated = 0;
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    for (const o of valid) {
      const key = compositeKey(o.source, o.source_listing_id);
      if (existingSet.has(key)) {
        updated += 1;
        if (updatedIds.length < SAMPLE_SIZE) updatedIds.push(o.source_listing_id);
      } else {
        inserted += 1;
        if (insertedIds.length < SAMPLE_SIZE) insertedIds.push(o.source_listing_id);
      }
    }
    return {
      saved: rows.length,
      skipped,
      inserted,
      updated,
      inserted_sample: insertedIds.length > 0 ? insertedIds : undefined,
      updated_sample: updatedIds.length > 0 ? updatedIds : undefined,
    };
  }

  // Fallback: pokud DB nemá UNIQUE(source, source_listing_id), upsert selže.
  if (!error.message.includes("no unique or exclusion constraint")) {
    throw new Error(`saveObservations: ${error.message}`);
  }

  let saved = 0;
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const source = row.source as string;
    const sourceListingId = row.source_listing_id as string;
    const { data: existing } = await supabase
      .from("market_observations")
      .select("id")
      .eq("source", source)
      .eq("source_listing_id", sourceListingId)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabase
        .from("market_observations")
        .update(row)
        .eq("source", source)
        .eq("source_listing_id", sourceListingId);
      if (!updateErr) {
        saved += 1;
        updated += 1;
      }
    } else {
      const { error: insertErr } = await supabase
        .from("market_observations")
        .insert(row);
      if (!insertErr) {
        saved += 1;
        inserted += 1;
      }
    }
  }
  return { saved, skipped, inserted, updated };
}
