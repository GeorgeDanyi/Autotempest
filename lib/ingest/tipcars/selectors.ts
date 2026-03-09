/**
 * TipCars parsing – central place for selectors and regex patterns.
 * Pokud TipCars změní HTML strukturu, upravte pouze tento soubor.
 *
 * Parsing layer uses these to extract listing cards and fields from list page HTML.
 */

export const TIPCARS_BASE_URL = "https://www.tipcars.com";

/** Used cars listing path (relative to base). */
export const TIPCARS_LIST_PATH = "/hledam/ojete-vozy";

/**
 * Regex to find listing links. TipCars uses absolute or relative URLs like:
 * https://www.tipcars.com/skoda-rapid/.../skoda-rapid-spaceback-1-0tsi-110ps-ambitio-12730171.html
 * or /skoda-rapid/hatchback/benzin/...-12730171.html
 * ID is the numeric part before .html.
 */
export const LISTING_LINK_REGEX =
  /<a[^>]+href="((?:https?:\/\/[^"]*tipcars\.com)?\/[^"]*-(\d+)\.html)"[^>]*>/gi;

/**
 * After finding a listing link, we take a context window of HTML around it
 * to extract title, price, year, mileage, fuel, power. Radius in characters.
 */
export const CONTEXT_RADIUS = 3500;

/**
 * Patterns to extract fields from listing card context (around the link).
 * Order matters for overlapping matches; first match wins where applicable.
 */
export const PATTERNS = {
  /** Price: "225 000 Kč" or "### 225 000 Kč" – first reasonable CZK amount in context */
  price: /(?:^|>)\s*#+\s*([\d\s\u00A0\.]+)\s*Kč|([\d\s\u00A0\.]{4,})\s*Kč/gi,

  /** Year: "03/2018" or "2017" near calendar icon or in text */
  year: /\b(\d{1,2})\/(\d{4})\b|\b(20\d{2}|19\d{2})\b/g,

  /** Mileage: "109 708 km" */
  mileage_km: /(\d[\d\s\u00A0\.]*)\s*km/gi,

  /** Power: "81 kW" or "176 kW" */
  power_kw: /(\d{1,3})\s*kW/gi,

  /** Fuel: Benzín, Nafta, Elektro, Hybrid, LPG, … */
  fuel: /\b(Benzín|Nafta|Elektro|Hybrid|LPG|CNG|Plug[\s-]?in)\b/gi,
} as const;

// --- Detail page selectors (křehké – upravte zde při změně HTML) ---

/**
 * Detail stránka: sekce "Základní informace" s labely.
 * Používáme regex na text po labelu (např. "tachometr:\n109 708 km").
 */
export const DETAIL_PATTERNS = {
  /** v provozu od: 3/2018 nebo 2018 (mezi labelem a hodnotou může být HTML) */
  year:
    /v\s+provozu\s+od[\s\S]{0,80}?(\d{1,2})\/(\d{4})|v\s+provozu\s+od[\s\S]{0,80}?(\d{4})/i,
  /** tachometr: 109 708 km (mezi labelem a hodnotou může být HTML/ikona) */
  mileage_km: /tachometr[\s\S]{0,120}?([\d\s\u00A0\.]{3,})\s*km/i,
  /** výkon: 81 kW / 110 PS */
  power_kw: /výkon[\s\S]{0,40}?(\d{1,3})\s*kW/i,
  /** palivo: benzin | nafta | elektro | hybrid … */
  fuel: /palivo[\s\S]{0,40}?(\w+)/i,
  /** převodovka: manuální převodovka | automatická … */
  transmission: /převodovka[\s\S]{0,80}?([^\n\!<]+?)(?=\s*\!|$|max\.)/im,
  /** karoserie: hatchback | kombi | sedan … */
  body_type: /karoserie[\s\S]{0,40}?(\w+)/i,
  /** Poznámka / popis – první odstavec po "Poznámka" */
  description: /##\s*Poznámka\s*([\s\S]*?)(?=##|$)/i,
} as const;

/** H1 nebo hlavní nadpis na detail stránce pro title (fallback) */
export const DETAIL_TITLE_REGEX =
  /<h1[^>]*>([\s\S]*?)<\/h1>|(?:\|\s*)([^|]+?)(?:\s*\|\s*Největší inzerce)/i;
