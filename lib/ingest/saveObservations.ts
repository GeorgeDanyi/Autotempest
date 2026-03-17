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

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: {
    source: string;
    source_listing_id: string;
    price_czk: unknown;
    mileage_km: unknown;
  }[] = [];

  for (let i = 0; i < valid.length; i++) {
    const o = valid[i]!;
    const row = rows[i]!;
    const key = compositeKey(o.source, o.source_listing_id);
    if (existingSet.has(key)) {
      toUpdate.push({
        source: o.source,
        source_listing_id: o.source_listing_id,
        price_czk: row.price_czk,
        mileage_km: row.mileage_km,
      });
    } else {
      toInsert.push(row);
    }
  }

  let inserted = 0;
  let updated = 0;
  const insertedIds: string[] = [];
  const updatedIds: string[] = [];

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("market_observations")
      .insert(toInsert);
    if (insertError) {
      throw new Error(`saveObservations insert: ${insertError.message}`);
    }
    for (const o of valid) {
      const key = compositeKey(o.source, o.source_listing_id);
      if (!existingSet.has(key)) {
        inserted += 1;
        if (insertedIds.length < SAMPLE_SIZE) {
          insertedIds.push(o.source_listing_id);
        }
      }
    }
  }

  if (toUpdate.length > 0) {
    const now = new Date().toISOString();
    for (const u of toUpdate) {
      const { error: updateError } = await supabase
        .from("market_observations")
        .update({
          price_czk: u.price_czk,
          mileage_km: u.mileage_km,
          last_seen_at: now,
        })
        .eq("source", u.source)
        .eq("source_listing_id", u.source_listing_id);
      if (updateError) {
        throw new Error(`saveObservations update: ${updateError.message}`);
      }
      updated += 1;
      if (updatedIds.length < SAMPLE_SIZE) {
        updatedIds.push(u.source_listing_id);
      }
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

export async function deactivateStaleObservations(
  supabase: SupabaseClient,
  source: string,
  staleTresholdHours = 48
): Promise<{ deactivated: number }> {
  const threshold = new Date(
    Date.now() - staleTresholdHours * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("market_observations")
    .update({ active: false })
    .eq("source", source)
    .eq("active", true)
    .lt("last_seen_at", threshold)
    .select("id");

  if (error) throw new Error(`deactivateStaleObservations: ${error.message}`);
  return { deactivated: data?.length ?? 0 };
}
