import { parseMileageKm, parsePriceCzk } from "@/lib/ingest/textNormalize";
import { splitTitleIntoBrandAndModel } from "@/lib/cars/multiWordBrands";

export type SautoParsedListing = {
  url: string;
  source_listing_id: string;
  title: string;
  brand: string | null;
  model: string | null;
  price_czk: number | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
  region: string | null;
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function cleanToken(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s
    .replace(/[,\.;:]+$/g, "") // trailing punctuation
    .replace(/^[,\.;:]+/g, "")
    .trim();
  return t.length ? t : null;
}

function stableHash(str: string): string {
  // djb2-ish hash (stable)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = (hash * 33) ^ str.charCodeAt(i);
  return (hash >>> 0).toString(16);
}

function extractContext(html: string, index: number, radius = 4000): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(html.length, index + radius);
  return html.slice(start, end);
}

function detectFuel(ctx: string): string | null {
  const lower = ctx.toLowerCase();
  if (/diesel|nafta|tdi/.test(lower)) return "Diesel";
  if (/benz[ií]n|benzin|tsi|tfsi/.test(lower)) return "Benzín";
  if (/hybrid/.test(lower)) return "Hybrid";
  if (/elektro|electric|bev/.test(lower)) return "Elektro";
  if (/lpg|cng/.test(lower)) return "LPG/CNG";
  return null;
}

function detectTransmission(ctx: string): string | null {
  const lower = ctx.toLowerCase();
  if (/automat|automatic|dsg|cvt/.test(lower)) return "Automat";
  if (/manu[aá]l|manual/.test(lower)) return "Manuál";
  return null;
}

function findPrice(ctx: string): number | null {
  const candidates: string[] = [];

  // čísla: 1 234 567 / 1 234 567 / 1.234.567
  const num = "(\\d{1,3}(?:[ \\u00A0\\.]?\\d{3})+)";
  const cur = "(?:Kč|kc|CZK|K&#269;|K&#x10D;|K&#x010D;)";

  const patterns = [
    new RegExp(num + "\\s*" + cur, "gi"),
    new RegExp(cur + "\\s*" + num, "gi"),
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(ctx))) {
      // u obou regexů je číslo vždy v jedné z capture skupin
      const captured = (m as any)[1] || (m as any)[2];
      if (captured) candidates.push(captured);
    }
  }

  for (const c of candidates) {
    const n = parsePriceCzk(c);
    if (n && n >= 20000 && n <= 5_000_000) return n;
  }
  return null;
}

function findYear(ctx: string): number | null {
  const matches = ctx.match(/\b(19|20)\d{2}\b/g);
  if (!matches || matches.length === 0) return null;

  const currentYear = new Date().getFullYear();
  const years = matches
    .map((x) => parseInt(x, 10))
    .filter((y) => Number.isFinite(y) && y >= 1980 && y <= currentYear + 1);

  if (years.length === 0) return null;
  return Math.max(...years);
}

export function parseSautoList(html: string): SautoParsedListing[] {
  const out: SautoParsedListing[] = [];
  if (!html) return out;

  // Bereme i relativní odkazy href="/detail/..."
  // Používáme [\s\S]*? místo flagu "s", aby fungovalo i při targetu < ES2018
  const re = /<a[^>]+href="([^"]*\/detail[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const rawHref = match[1];
      const anchorHtml = match[2] ?? "";
      const idx = match.index;

      let url = rawHref;
      try {
        url = new URL(rawHref, "https://www.sauto.cz").toString();
      } catch {
        // leave as-is
      }

      const idMatch =
        url.match(/detail\/(\d{5,})/i) ||
        url.match(/(\d{5,})/);

      const source_listing_id = idMatch?.[1] ?? stableHash(url);
      const title = stripHtml(anchorHtml);

      let brand: string | null = null;
      let model: string | null = null;
      if (title) {
        const multiWord = splitTitleIntoBrandAndModel(title);
        if (multiWord) {
          brand = multiWord.brandDisplay;
          model = cleanToken(multiWord.model || null);
        } else {
          const parts = title.split(/\s+/);
          brand = cleanToken(parts[0] ?? null);
          model = cleanToken(parts[1] ?? null);
        }
      }

      const ctx = extractContext(html, idx);

      const mileageMatch = ctx.match(/(\d{1,3}(?:\s?\d{3})+)\s*km/i);

      const price_czk = findPrice(ctx);
      const mileage_km = mileageMatch ? parseMileageKm(mileageMatch[0]) : null;
      const year = findYear(ctx);

      const fuel = detectFuel(ctx);
      const transmission = detectTransmission(ctx);

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
        region: null,
      });
    } catch {
      // robust: skip and continue
      continue;
    }
  }
  console.log("[sauto][parse]", "html length:", html.length, "matches:", out.length);
  const seen = new Set<string>();
  return out.filter((item) => {
    if (!item.source_listing_id || item.source_listing_id.length < 5) return false;
    if (seen.has(item.source_listing_id)) return false;
    seen.add(item.source_listing_id);
    return true;
  });
}
