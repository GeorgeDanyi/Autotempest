/**
 * Mapování Sauto listingu na RawObservationInput pro normalizeObservation().
 * Stejný mentální model jako TipCars: list → map → normalize → saveObservations.
 */

import { buildModelKey } from "@/lib/ingest/textNormalize";
import { normalizeModelKey } from "@/lib/cars/normalizeModel";
import { detectEngineKey } from "@/lib/ingest/detectEngineKey";
import { normalizeBrandForDb } from "@/lib/analyze/normalizeBrandKey";
import { validateModelKey } from "@/lib/ingest/validateModelKey";
import type { RawObservationInput } from "@/lib/ingest/normalizeObservation";
import type { SautoParsedListing } from "./parseListPage";

const SOURCE = "sauto";

function buildEngineRaw(listing: SautoParsedListing): string | null {
  const parts: string[] = [];
  if (listing.title) parts.push(listing.title);
  if (listing.brand) parts.push(listing.brand);
  if (listing.model) parts.push(listing.model);
  if (listing.fuel) parts.push(listing.fuel);
  if (listing.transmission) parts.push(listing.transmission);
  const t = parts.join(" ").trim();
  return t || null;
}

/**
 * Mapuje jeden SautoParsedListing na RawObservationInput.
 * model_key: normalizeModelKey(brand, model, title) ?? buildModelKey(brand, model).
 * engine_key: detectEngineKey(engineRaw).
 */
export function mapSautoToObservation(
  listing: SautoParsedListing
): RawObservationInput {
  const now = new Date().toISOString();
  const engineRaw = buildEngineRaw(listing);
  const model_key =
    normalizeModelKey({
      brand: listing.brand ?? undefined,
      model: listing.model ?? undefined,
      trim: listing.title ?? undefined,
    }) ?? (listing.brand && listing.model ? buildModelKey(listing.brand, listing.model) : "");

  const brandDisplay = normalizeBrandForDb(listing.brand) ?? listing.brand ?? undefined;
  const finalModelKey = model_key || "unknown";
  validateModelKey(brandDisplay ?? null, listing.model ?? null, finalModelKey);

  return {
    source: SOURCE,
    source_listing_id: listing.source_listing_id,
    source_url: listing.url ?? undefined,
    title: listing.title ?? undefined,
    model_key: finalModelKey,
    brand: brandDisplay,
    model: listing.model ?? undefined,
    price_czk: listing.price_czk ?? 0,
    year: listing.year ?? undefined,
    mileage_km: listing.mileage_km ?? undefined,
    fuel: listing.fuel ?? undefined,
    transmission: listing.transmission ?? undefined,
    engine: engineRaw ?? undefined,
    engine_key: engineRaw ? (detectEngineKey(engineRaw) ?? undefined) : undefined,
    power_kw: undefined,
    body_type: undefined,
    drivetrain: undefined,
    location: listing.region ?? undefined,
    description: undefined,
    observed_at: now,
  };
}
