import type { SearchParams } from "./types";

const SAUTO_BASE = "https://www.sauto.cz/";

export function buildSautoUrl(params: SearchParams): string {
  const url = new URL(SAUTO_BASE);
  const q =
    (params.q && params.q.trim()) ||
    [params.make, params.model].filter(Boolean).join(" ").trim();
  if (q) url.searchParams.set("text", q);
  if (params.priceMin && params.priceMin > 0) url.searchParams.set("priceFrom", String(params.priceMin));
  if (params.priceMax && params.priceMax > 0) url.searchParams.set("priceTo", String(params.priceMax));
  if (params.yearMin && params.yearMin > 0) url.searchParams.set("yearFrom", String(params.yearMin));
  if (params.mileageMax && params.mileageMax > 0) url.searchParams.set("mileageTo", String(params.mileageMax));
  return url.toString();
}

// autotempest/lib/ingest/textNormalize.ts

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function slugifyNoDiacritics(input: string): string {
  const noDia = stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return noDia || "";
}

export function buildModelKey(brand: string, model: string): string {
  return `${slugifyNoDiacritics(brand)}_${slugifyNoDiacritics(model)}`;
}

export function parseIntSafe(s: string | null | undefined): number | null {
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function parsePriceCzk(text: string | null | undefined): number | null {
  if (!text) return null;
  return parseIntSafe(text);
}

export function parseMileageKm(text: string | null | undefined): number | null {
  if (!text) return null;
  return parseIntSafe(text);
}

export function parseYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const year = parseInt(m[0], 10);
  if (!Number.isFinite(year)) return null;
  if (year < 1900 || year > 2100) return null;
  return year;
}