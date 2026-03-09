/**
 * Jednotný datový model pro vozidla před uložením do market_observations.
 * Všechny ingest zdroje (sauto, tipcars, …) normalizují na tento tvar.
 *
 * Raw vs normalized:
 * - source_url, title, description, location, engine (→ engine_raw) = raw ze zdroje
 * - model_key, brand, model, fuel, transmission, engine_key = normalizované
 * - year, mileage_km, price_czk, power_kw = číselně normalizované
 */

export type NormalizedVehicleObservation = {
  source: string;
  source_listing_id: string;
  source_url: string | null;
  title: string | null;
  model_key: string;
  brand: string | null;
  model: string | null;
  price_czk: number;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
  engine: string | null;
  engine_key: string | null;
  power_kw: number | null;
  body_type: string | null;
  drivetrain: string | null;
  location: string | null;
  description: string | null;
  observed_at: string;
};
