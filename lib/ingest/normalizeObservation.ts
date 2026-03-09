/**
 * Normalizace raw objektu na NormalizedVehicleObservation.
 * Validuje povinná pole, převádí typy a ořezává stringy.
 */

import type { NormalizedVehicleObservation } from "./types";

const REQUIRED_KEYS = ["source", "source_listing_id", "model_key", "price_czk", "observed_at"] as const;

function trim(s: unknown): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type RawObservationInput = Partial<{
  source: string;
  source_listing_id: string;
  source_url: string;
  title: string;
  model_key: string;
  brand: string;
  model: string;
  price_czk: number | string;
  year: number | string;
  mileage_km: number | string;
  fuel: string;
  transmission: string;
  engine: string;
  engine_key: string;
  power_kw: number | string;
  body_type: string;
  drivetrain: string;
  location: string;
  description: string;
  observed_at: string;
}>;

/**
 * Přijme částečný raw objekt, zkontroluje povinná pole, převede čísla a ořízne stringy.
 * Vrátí validní NormalizedVehicleObservation nebo null.
 */
export function normalizeObservation(raw: RawObservationInput): NormalizedVehicleObservation | null {
  const source = trim(raw.source);
  const source_listing_id = trim(raw.source_listing_id);
  const model_key = trim(raw.model_key);
  const observed_at = trim(raw.observed_at);

  if (!source || !source_listing_id || !model_key || !observed_at) return null;

  const priceNum = toNumber(raw.price_czk);
  if (priceNum == null || priceNum < 0) return null;

  const yearNum = toNumber(raw.year);
  const mileageNum = toNumber(raw.mileage_km);

  const powerKwNum = toNumber(raw.power_kw);

  return {
    source,
    source_listing_id,
    source_url: trim(raw.source_url),
    title: trim(raw.title),
    model_key,
    brand: trim(raw.brand),
    model: trim(raw.model),
    price_czk: priceNum,
    year: yearNum,
    mileage_km: mileageNum,
    fuel: trim(raw.fuel),
    transmission: trim(raw.transmission),
    engine: trim(raw.engine),
    engine_key: trim(raw.engine_key),
    power_kw: powerKwNum,
    body_type: trim(raw.body_type),
    drivetrain: trim(raw.drivetrain),
    location: trim(raw.location),
    description: trim(raw.description),
    observed_at,
  };
}
