/**
 * PARSING LAYER – TipCars detail page.
 * Z HTML detail stránky vytěží pole pro enrichment (mileage, year, fuel, transmission, power, body_type, …).
 * Selektory jsou v selectors.ts (DETAIL_PATTERNS).
 */

import { parseMileageKm } from "@/lib/ingest/textNormalize";
import { DETAIL_PATTERNS, DETAIL_TITLE_REGEX } from "./selectors";

export type TipcarsDetailData = {
  mileage_km: number | null;
  year: number | null;
  fuel: string | null;
  transmission: string | null;
  power_kw: number | null;
  /** Raw text pro engine_key detekci (např. z titulku nebo sekce Motor) */
  engine_raw: string | null;
  body_type: string | null;
  location: string | null;
  title: string | null;
  description: string | null;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeFuel(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (/nafta|diesel/.test(t)) return "Diesel";
  if (/benzin|benzín/.test(t)) return "Benzín";
  if (/elektro|electric/.test(t)) return "Elektro";
  if (/hybrid/.test(t)) return "Hybrid";
  if (/lpg|cng/.test(t)) return "LPG/CNG";
  return raw.trim() || null;
}

function normalizeTransmission(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (/automat|automatic|dsg|cvt|at\s*\d/i.test(t)) return "Automat";
  if (/manu[aá]l|manual/i.test(t)) return "Manuál";
  return raw.trim() || null;
}

/**
 * Parsuje HTML detail stránky na TipcarsDetailData.
 * Všechny selektory v selectors.ts – při změně HTML upravte tam.
 */
export function parseTipcarsDetail(html: string): TipcarsDetailData {
  const out: TipcarsDetailData = {
    mileage_km: null,
    year: null,
    fuel: null,
    transmission: null,
    power_kw: null,
    engine_raw: null,
    body_type: null,
    location: null,
    title: null,
    description: null,
  };
  if (!html) return out;

  const yearMatch = html.match(DETAIL_PATTERNS.year);
  if (yearMatch) {
    if (yearMatch[2]) {
      const y = parseInt(yearMatch[2], 10);
      if (Number.isFinite(y) && y >= 1980 && y <= 2100) out.year = y;
    } else if (yearMatch[3]) {
      const y = parseInt(yearMatch[3], 10);
      if (Number.isFinite(y) && y >= 1980 && y <= 2100) out.year = y;
    }
  }

  const mileageMatch = html.match(DETAIL_PATTERNS.mileage_km);
  if (mileageMatch && mileageMatch[1]) {
    out.mileage_km = parseMileageKm(mileageMatch[1]);
  }

  const powerMatch = html.match(DETAIL_PATTERNS.power_kw);
  if (powerMatch && powerMatch[1]) {
    const n = parseInt(powerMatch[1], 10);
    if (Number.isFinite(n)) out.power_kw = n;
  }

  const fuelMatch = html.match(DETAIL_PATTERNS.fuel);
  if (fuelMatch && fuelMatch[1]) {
    out.fuel = normalizeFuel(fuelMatch[1]);
  }

  const transmissionMatch = html.match(DETAIL_PATTERNS.transmission);
  if (transmissionMatch && transmissionMatch[1]) {
    out.transmission = normalizeTransmission(
      stripHtml(transmissionMatch[1])
    );
  }

  const bodyMatch = html.match(DETAIL_PATTERNS.body_type);
  if (bodyMatch && bodyMatch[1]) {
    out.body_type = stripHtml(bodyMatch[1]) || null;
  }

  const descMatch = html.match(DETAIL_PATTERNS.description);
  if (descMatch && descMatch[1]) {
    out.description = stripHtml(descMatch[1]).slice(0, 2000) || null;
  }

  const titleMatch = html.match(DETAIL_TITLE_REGEX);
  if (titleMatch && (titleMatch[1] || titleMatch[2])) {
    out.title = stripHtml(titleMatch[1] || titleMatch[2] || "") || null;
  }

  // engine_raw: z titulku (např. "1.0TSi 110PS") + výkon + palivo + převodovka pro detectEngineKey
  const engineParts: string[] = [];
  if (out.title) engineParts.push(out.title);
  if (out.power_kw != null) engineParts.push(`${out.power_kw} kW`);
  if (out.fuel) engineParts.push(out.fuel);
  if (out.transmission) engineParts.push(out.transmission);
  if (engineParts.length > 0) {
    out.engine_raw = engineParts.join(" ");
  }

  return out;
}
