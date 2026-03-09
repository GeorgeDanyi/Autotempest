/**
 * NORMALIZATION LAYER – TipCars.
 * Mapuje TipcarsParsedListing na RawObservationInput pro normalizeObservation(),
 * používá shared logiku: buildModelKey, normalizeModelKey, detectEngineKey.
 * Výstup je ve stejném tvaru jako Sauto (NormalizedVehicleObservation).
 */

import { buildModelKey } from "@/lib/ingest/textNormalize";
import { normalizeModelKey } from "@/lib/cars/normalizeModel";
import { detectEngineKey } from "@/lib/ingest/detectEngineKey";
import { normalizeBrandForDb } from "@/lib/analyze/normalizeBrandKey";
import { validateModelKey } from "@/lib/ingest/validateModelKey";
import type { RawObservationInput } from "@/lib/ingest/normalizeObservation";
import type { TipcarsParsedListing } from "./parseTipcarsListing";

const SOURCE = "tipcars";

/**
 * Sestaví řetězec pro detekci engine_key.
 * Pokud má listing engine_raw z detail stránky, použije ho; jinak title + brand + model + fuel + transmission + engine_trim.
 */
function buildEngineRaw(parsed: TipcarsParsedListing): string | null {
  if (parsed.engine_raw != null && String(parsed.engine_raw).trim() !== "")
    return parsed.engine_raw.trim();
  const parts: string[] = [];
  if (parsed.title) parts.push(parsed.title);
  if (parsed.brand) parts.push(parsed.brand);
  if (parsed.model) parts.push(parsed.model);
  if (parsed.fuel) parts.push(parsed.fuel);
  if (parsed.transmission) parts.push(parsed.transmission);
  if (parsed.engine_trim) parts.push(parsed.engine_trim);
  const t = parts.join(" ").trim();
  return t || null;
}

/**
 * Mapuje jeden TipcarsParsedListing na RawObservationInput.
 * model_key: normalizeModelKey(brand, model, title) ?? buildModelKey(brand, model).
 * engine_key: detectEngineKey(engineRaw).
 */
export function mapTipcarsToObservation(
  parsed: TipcarsParsedListing
): RawObservationInput {
  const now = new Date().toISOString();
  const engineRaw = buildEngineRaw(parsed);
  const model_key =
    normalizeModelKey({
      brand: parsed.brand ?? undefined,
      model: parsed.model ?? undefined,
      trim: parsed.title ?? undefined,
    }) ?? (parsed.brand && parsed.model ? buildModelKey(parsed.brand, parsed.model) : "");

  const brandDisplay = normalizeBrandForDb(parsed.brand) ?? parsed.brand ?? undefined;
  const finalModelKey = model_key || "unknown";
  validateModelKey(brandDisplay ?? null, parsed.model ?? null, finalModelKey);

  return {
    source: SOURCE,
    source_listing_id: parsed.source_listing_id,
    source_url: parsed.url,
    title: parsed.title ?? undefined,
    model_key: finalModelKey,
    brand: brandDisplay,
    model: parsed.model ?? undefined,
    price_czk: parsed.price_czk ?? 0,
    year: parsed.year ?? undefined,
    mileage_km: parsed.mileage_km ?? undefined,
    fuel: parsed.fuel ?? undefined,
    transmission: parsed.transmission ?? undefined,
    engine: engineRaw ?? undefined,
    engine_key: engineRaw ? (detectEngineKey(engineRaw) ?? undefined) : undefined,
    power_kw: parsed.power_kw ?? undefined,
    body_type: parsed.body_type ?? undefined,
    drivetrain: undefined,
    location: parsed.location ?? undefined,
    description: undefined,
    observed_at: now,
  };
}
