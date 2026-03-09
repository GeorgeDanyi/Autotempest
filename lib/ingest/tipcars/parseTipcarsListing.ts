/**
 * PARSING LAYER – TipCars.
 * Bere HTML z fetch vrstvy a vytěží strukturovaná data z každého inzerátu na stránce.
 * Všechny selektory a regex jsou v selectors.ts – úpravy pouze tam.
 */

import { parsePriceCzk, parseMileageKm, parseYear } from "@/lib/ingest/textNormalize";
import {
  LISTING_LINK_REGEX,
  CONTEXT_RADIUS,
  PATTERNS,
  TIPCARS_BASE_URL,
} from "./selectors";
import { splitUrlPathIntoBrandAndModel } from "@/lib/cars/multiWordBrands";

export type TipcarsParsedListing = {
  url: string;
  source_listing_id: string;
  title: string | null;
  brand: string | null;
  model: string | null;
  price_czk: number | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
  power_kw: number | null;
  /** Raw engine/trim text (subtitle under title) for engine_key detection; může být doplněno z detailu */
  engine_trim: string | null;
  /** Raw engine text z detail stránky (priorita pro detectEngineKey) */
  engine_raw: string | null;
  /** Karoserie z detail stránky */
  body_type: string | null;
  /** Dealer/location if present in card or detail */
  location: string | null;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function extractContext(html: string, index: number, radius: number): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(html.length, index + radius);
  return html.slice(start, end);
}

/** Parse brand and model from URL path: /skoda-rapid/... -> Skoda, Rapid; /land-rover-discovery/ -> Land Rover, Discovery */
function brandModelFromUrlPath(url: string): { brand: string | null; model: string | null } {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const first = segments[0];
    if (!first || first === "hledam" || first === "ojete-vozy") return { brand: null, model: null };
    const parts = first.split("-");
    if (parts.length < 2) return { brand: null, model: null };

    const multiWord = splitUrlPathIntoBrandAndModel(parts);
    if (multiWord) {
      return {
        brand: multiWord.brandDisplay,
        model: multiWord.model.trim() || null,
      };
    }

    const brand = parts[0];
    const model = parts.slice(1).join("-");
    const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    return {
      brand: capitalize(brand),
      model: model.split("-").map(capitalize).join(" "),
    };
  } catch {
    return { brand: null, model: null };
  }
}

function findFirstPrice(ctx: string): number | null {
  const re = new RegExp(PATTERNS.price.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx))) {
    const g1 = m[1] ?? m[2];
    if (g1) {
      const n = parsePriceCzk(g1);
      if (n != null && n >= 10000) return n;
    }
  }
  return null;
}

function findFirstYear(ctx: string): number | null {
  const re = new RegExp(PATTERNS.year.source, "g");
  const currentYear = new Date().getFullYear();
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx))) {
    let y: number;
    if (m[2]) {
      y = parseInt(m[2], 10);
    } else if (m[3]) {
      y = parseInt(m[3], 10);
    } else {
      continue;
    }
    if (Number.isFinite(y) && y >= 1980 && y <= currentYear + 1) {
      if (best == null || y > best) best = y;
    }
  }
  return best;
}

function findFirstMileage(ctx: string): number | null {
  const re = new RegExp(PATTERNS.mileage_km.source, "gi");
  const m = re.exec(ctx);
  if (!m || !m[1]) return null;
  return parseMileageKm(m[1]);
}

function findFirstPowerKw(ctx: string): number | null {
  const re = new RegExp(PATTERNS.power_kw.source, "gi");
  const m = re.exec(ctx);
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function findFirstFuel(ctx: string): string | null {
  const re = new RegExp(PATTERNS.fuel.source, "gi");
  const m = re.exec(ctx);
  if (!m) return null;
  const raw = m[1] ?? m[0];
  if (/nafta/i.test(raw)) return "Diesel";
  if (/benzin/i.test(raw)) return "Benzín";
  if (/elektro|electric/i.test(raw)) return "Elektro";
  if (/hybrid/i.test(raw)) return "Hybrid";
  if (/lpg|cng|plug/i.test(raw)) return "LPG/CNG";
  return raw.trim() || null;
}

/** Detect transmission from context (manuál, automat, DSG, …) */
function detectTransmission(ctx: string): string | null {
  const lower = ctx.toLowerCase();
  if (/automat|automatic|dsg|cvt|at8|at\s*\d/i.test(lower)) return "Automat";
  if (/manu[aá]l|manual|převodovka\s*6\s*rychl/i.test(lower)) return "Manuál";
  return null;
}

/**
 * Parse one list page HTML into an array of TipcarsParsedListing.
 * Uses selectors from selectors.ts so HTML changes can be handled in one place.
 */
export function parseTipcarsListPage(html: string): TipcarsParsedListing[] {
  const out: TipcarsParsedListing[] = [];
  if (!html) return out;

  const re = new RegExp(LISTING_LINK_REGEX.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    try {
      const fullHref = match[1];
      const id = match[2];
      if (!id || !fullHref) continue;

      let url = fullHref;
      try {
        url = new URL(fullHref, TIPCARS_BASE_URL).toString();
      } catch {
        // leave as-is
      }

      const source_listing_id = id;
      const idx = match.index;
      const ctx = extractContext(html, idx, CONTEXT_RADIUS);

      const { brand, model } = brandModelFromUrlPath(url);

      // Title: often in link text as "### Brand Model" and next line is trim (engine_trim)
      const afterTag = html.slice(idx + match[0].length, idx + match[0].length + 400);
      const titlePart = stripHtml(afterTag).split(/\s*#+\s*/)[0]?.trim();
      const title = [brand, model].filter(Boolean).join(" ") || titlePart || null;
      const engine_trim = titlePart && titlePart.length < 80 ? titlePart : null;

      const price_czk = findFirstPrice(ctx);
      const year = findFirstYear(ctx);
      const mileage_km = findFirstMileage(ctx);
      const power_kw = findFirstPowerKw(ctx);
      const fuel = findFirstFuel(ctx);
      const transmission = detectTransmission(ctx);

      // Location: dealer name often at end of card; optional, leave simple
      const location: string | null = null;

      out.push({
        url,
        source_listing_id,
        title,
        brand,
        model,
        price_czk,
        year,
        mileage_km,
        fuel,
        transmission,
        power_kw,
        engine_trim,
        engine_raw: null,
        body_type: null,
        location,
      });
    } catch {
      continue;
    }
  }

  return out;
}

/**
 * Parse multiple HTML pages and merge; dedupe by source_listing_id (keep first).
 */
export function parseTipcarsListPages(htmlPerPage: string[]): TipcarsParsedListing[] {
  const byId = new Map<string, TipcarsParsedListing>();
  for (const html of htmlPerPage) {
    const list = parseTipcarsListPage(html);
    for (const item of list) {
      if (item.source_listing_id && !byId.has(item.source_listing_id)) {
        byId.set(item.source_listing_id, item);
      }
    }
  }
  return Array.from(byId.values());
}
