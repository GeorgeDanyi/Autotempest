/**
 * Jediný source of truth pro URL parametry stránky /analyze.
 * Všechny komponenty (quick search, filtry, AnalyzePageClient) čtou a zapisují
 * pouze přes tento modul – žádné paralelní lokální mapování.
 */

import { normalizeEngineParam } from "./engineKeys";
import { normalizeBrandKey } from "./normalizeBrandKey";

function safeString(value: string | null): string | null {
  if (value == null) return null;
  try {
    const s = String(value).trim();
    if (s === "") return null;
    if (s.length > 200) return null;
    return s;
  } catch {
    return null;
  }
}

function safeYear(value: string | null): string | null {
  if (value == null) return null;
  const n = parseInt(String(value).replace(/\D/g, ""), 10);
  if (Number.isNaN(n) || n < 1990 || n > 2030) return null;
  return String(n);
}

function safeMileage(value: string | null): string | null {
  if (value == null) return null;
  const n = parseInt(String(value).replace(/\D/g, ""), 10);
  if (Number.isNaN(n) || n < 0) return null;
  return String(n);
}

export type SourceMode = "all_sources" | "sauto_only";

export type AnalyzeParams = {
  brand: string | null;
  model: string | null;
  yearFrom: string | null;
  yearTo: string | null;
  mileageFrom: string | null;
  mileageTo: string | null;
  engine: string | null;
  fuels: string | null;
  transmission: string | null;
  /** all_sources (výchozí) | sauto_only pro porovnání pricing bez TipCars */
  source_mode: SourceMode | null;
};

const EMPTY: AnalyzeParams = {
  brand: null,
  model: null,
  yearFrom: null,
  yearTo: null,
  mileageFrom: null,
  mileageTo: null,
  engine: null,
  fuels: null,
  transmission: null,
  source_mode: null,
};

/**
 * Čte a normalizuje parametry z URL. Nikdy nehází – neplatné hodnoty → null.
 */
export function parseAnalyzeParams(searchParams: URLSearchParams): AnalyzeParams {
  try {
    const get = (key: string) => {
      try {
        return searchParams.get(key);
      } catch {
        return null;
      }
    };

    const model = safeString(get("model"));
    const brandRaw = safeString(get("brand"));
    const brand = brandRaw ? (normalizeBrandKey(brandRaw) || null) : null;
    const yearFrom = safeYear(get("yearFrom")) ?? safeYear(get("year"));
    const yearTo = safeYear(get("yearTo")) ?? safeYear(get("year"));
    const mileageFrom = safeMileage(get("mileageFrom")) ?? null;
    const mileageTo = safeMileage(get("mileageTo")) ?? safeMileage(get("mileage_km"));
    const engine = normalizeEngineParam(get("engine"));
    const fuels = safeString(get("fuels"));
    const transmission = safeString(get("transmission"));
    const sourceModeRaw = safeString(get("source_mode"))?.toLowerCase();
    const source_mode: SourceMode | null =
      sourceModeRaw === "sauto_only" || sourceModeRaw === "all_sources" ? sourceModeRaw : null;

    return {
      brand,
      model,
      yearFrom,
      yearTo,
      mileageFrom,
      mileageTo,
      engine,
      fuels,
      transmission,
      source_mode,
    };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * Sestaví URLSearchParams z normalizovaného objektu.
 * Pouze neprázdné hodnoty se zapisují.
 */
export function buildAnalyzeSearchParams(
  params: Partial<AnalyzeParams>,
  existing?: URLSearchParams,
): URLSearchParams {
  const out = existing ? new URLSearchParams(existing.toString()) : new URLSearchParams();

  const set = (key: string, value: string | null) => {
    if (value != null && value !== "") {
      out.set(key, value);
    } else {
      out.delete(key);
    }
  };

  if (params.brand !== undefined) set("brand", params.brand); // vždy normalizovaný key (např. skoda)
  if (params.model !== undefined) set("model", params.model);
  if (params.yearFrom !== undefined) set("yearFrom", params.yearFrom);
  if (params.yearTo !== undefined) set("yearTo", params.yearTo);
  if (params.mileageFrom !== undefined) set("mileageFrom", params.mileageFrom);
  if (params.mileageTo !== undefined) set("mileageTo", params.mileageTo);
  if (params.engine !== undefined) set("engine", params.engine);
  if (params.fuels !== undefined) set("fuels", params.fuels);
  if (params.transmission !== undefined) set("transmission", params.transmission);
  if (params.source_mode === "sauto_only") set("source_mode", "sauto_only");
  else if (params.source_mode !== undefined) out.delete("source_mode");

  return out;
}

/**
 * Převádí AnalyzeParams na parametry pro /api/price.
 * Vrací pouze objekt s validními hodnotami (žádný undefined/null do URLSearchParams).
 * API očekává: model_key, year nebo yearFrom/yearTo, mileage_km, engine, fuel, brand.
 */
export function analyzeParamsToPriceQuery(
  params: AnalyzeParams,
): Record<string, string> {
  const result: Record<string, string> = {};

  const model_key = params.model?.trim();
  if (model_key) result.model_key = model_key;

  const yearFrom = params.yearFrom;
  const yearTo = params.yearTo;
  const sameYear = yearFrom != null && yearTo != null && yearFrom === yearTo;
  if (sameYear) {
    result.year = yearFrom;
    delete result.yearFrom;
    delete result.yearTo;
  } else {
    if (params.yearFrom) result.yearFrom = params.yearFrom;
    if (params.yearTo) result.yearTo = params.yearTo;
    delete result.year;
  }

  const mileage_km = params.mileageTo?.trim();
  if (mileage_km) result.mileage_km = mileage_km;
  if (params.mileageFrom?.trim()) result.mileageFrom = params.mileageFrom.trim();

  const engine = params.engine?.trim();
  if (engine) result.engine = engine;

  const fuel = params.fuels?.split(",")[0]?.trim();
  if (fuel) result.fuel = fuel;

  const brand = params.brand?.trim();
  if (brand) result.brand = brand;

  if (params.source_mode === "sauto_only") result.source_mode = "sauto_only";

  return result;
}

export { EMPTY as EMPTY_ANALYZE_PARAMS };
