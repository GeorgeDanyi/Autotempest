import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  upsertMarketObservationRow,
  type MarketObservationInsert,
} from "@/lib/ingest/ingestSautoSingle";
import {
  buildModelKey,
  parseMileageKm,
  parsePriceCzk,
  parseYear,
} from "@/lib/ingest/textNormalize";
import { normalizeModelKey } from "@/lib/cars/normalizeModel";
import { normalizeBrandForDb } from "@/lib/analyze/normalizeBrandKey";

type DetailResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
        // běžný prohlížečový UA, žádné triky
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
  const num = "(\\d{1,3}(?:[ \\u00A0\\.]?\\d{3})+)";
  const cur = "(?:Kč|kc|CZK|K&#269;|K&#x10D;|K&#x010D;)";

  const patterns = [
    new RegExp(num + "\\s*" + cur, "gi"),
    new RegExp(cur + "\\s*" + num, "gi"),
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(ctx))) {
      const captured = (m as any)[1] || (m as any)[2];
      if (captured) candidates.push(captured);
    }
  }

  for (const c of candidates) {
    const n = parsePriceCzk(c);
    if (n && n >= 10000) return n;
  }
  return null;
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(html))) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const json = JSON.parse(raw.trim());
      if (Array.isArray(json)) {
        for (const item of json) out.push(item);
      } else {
        out.push(json);
      }
    } catch {
      continue;
    }
  }
  return out;
}

function extractFromJsonLd(objs: any[]): Partial<MarketObservationInsert> | null {
  for (const obj of objs) {
    if (!obj || typeof obj !== "object") continue;

    const brand =
      typeof obj.brand === "string"
        ? obj.brand
        : typeof obj.brand?.name === "string"
        ? obj.brand.name
        : null;
    const model =
      typeof obj.model === "string"
        ? obj.model
        : typeof obj.vehicleModel === "string"
        ? obj.vehicleModel
        : typeof obj.name === "string"
        ? obj.name
        : null;

    let price: number | null = null;
    const rawPrice =
      obj.offers?.price ??
      obj.price ??
      (typeof obj.offers?.priceCurrency === "string"
        ? obj.offers.priceCurrency
        : null);

    if (typeof rawPrice === "number") {
      price = Math.round(rawPrice);
    } else if (typeof rawPrice === "string") {
      price = parsePriceCzk(rawPrice);
    }

    if (!brand || !model || price == null) continue;

    let year: number | null = null;
    const yearSource =
      obj.modelDate ?? obj.productionDate ?? obj.vehicleModelDate ?? null;
    if (typeof yearSource === "string") {
      year = parseYear(yearSource);
    }

    let mileage_km: number | null = null;
    const mileageSource =
      obj.mileageFromOdometer?.value ?? obj.mileage?.value ?? null;
    if (typeof mileageSource === "number") {
      mileage_km = Math.round(mileageSource);
    } else if (typeof mileageSource === "string") {
      mileage_km = parseMileageKm(mileageSource);
    }

    const fuel: string | null =
      typeof obj.fuelType === "string" ? obj.fuelType : null;
    const transmission: string | null =
      typeof obj.vehicleTransmission === "string"
        ? obj.vehicleTransmission
        : null;

    let region: string | null = null;
    if (obj.address) {
      if (typeof obj.address.addressRegion === "string") {
        region = obj.address.addressRegion;
      } else if (typeof obj.address.addressLocality === "string") {
        region = obj.address.addressLocality;
      }
    }
    const titleText = typeof obj.name === "string" ? obj.name : null;

    const model_key =
      normalizeModelKey({ brand, model, trim: titleText }) ??
      buildModelKey(brand, model);

    return {
      source: "sauto",
      brand,
      model,
      model_key,
      trim: null,
      fuel,
      transmission,
      year: year ?? null,
      mileage_km,
      price_czk: price,
      region,
      source_listing_id: "",
    };
  }

  return null;
}

function extractFromHtml(html: string): Partial<MarketObservationInsert> | null {
  let titleText: string | null = null;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    titleText = stripHtml(h1Match[1]);
  } else {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      titleText = stripHtml(titleMatch[1]);
    }
  }

  if (!titleText) return null;
  const parts = titleText.split(/\s+/);
  const brand = parts[0] ?? "";
  const model = parts[1] ?? "";
  if (!brand || !model) return null;

  const price_czk = findPrice(html);
  if (!price_czk) return null;

  const year = parseYear(html);

  let mileage_km: number | null = null;
  const mileageMatch = html.match(/(\d{1,3}(?:\s?\d{3}))\s*km/i);
  if (mileageMatch) {
    mileage_km = parseMileageKm(mileageMatch[0]);
  }

  const fuel = detectFuel(html);
  const transmission = detectTransmission(html);

  let region: string | null = null;
  const regionMatch = html.match(
    /<span[^>]*class="[^"]*(?:region|lokalita)[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
  if (regionMatch) {
    region = stripHtml(regionMatch[1]);
  }

  const model_key =
    normalizeModelKey({ brand, model, trim: titleText }) ??
    buildModelKey(brand, model);

  return {
    source: "sauto",
    brand,
    model,
    model_key,
    trim: null,
    fuel,
    transmission,
    year: year ?? null,
    mileage_km,
    price_czk,
    region,
    source_listing_id: "",
  };
}

async function fetchDetailHtml(
  source_listing_id: string,
): Promise<{ ok: true; html: string; status: number } | { ok: false; status: number }> {
  const candidates = [
    `https://www.sauto.cz/detail/${encodeURIComponent(source_listing_id)}`,
    `https://www.sauto.cz/osobni/detail/${encodeURIComponent(
      source_listing_id,
    )}`,
  ];

  let lastStatus = 0;

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, 10_000);
      lastStatus = res.status;

      if (res.status === 429 || res.status === 403) {
        return { ok: false, status: res.status };
      }

      if (res.status === 404 || res.status === 410) {
        // try next candidate
        continue;
      }

      if (res.ok) {
        const html = await res.text();
        return { ok: true, html, status: res.status };
      }
    } catch {
      // try next candidate
      continue;
    }
  }

  if (lastStatus === 404 || lastStatus === 410) {
    return { ok: false, status: 404 };
  }

  return { ok: false, status: lastStatus || 500 };
}

export async function ingestSautoDetail(input: {
  source_listing_id: string;
}): Promise<DetailResult> {
  const { source_listing_id } = input;
  if (!source_listing_id) {
    return { ok: false, error: "source_listing_id required" };
  }

  let htmlResult;
  try {
    htmlResult = await fetchDetailHtml(source_listing_id);
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "timeout while fetching SAUTO" : "Network error";
    return { ok: false, error: msg, status: msg.includes("timeout") ? 504 : 500 };
  }

  if (!htmlResult.ok) {
    if (htmlResult.status === 404) {
      return { ok: false, error: "Listing not found on detail", status: 404 };
    }
    if (htmlResult.status === 429 || htmlResult.status === 403) {
      return {
        ok: false,
        error: "Rate limited / Forbidden",
        status: htmlResult.status,
      };
    }
    if (htmlResult.status === 0) {
      return { ok: false, error: "timeout while fetching SAUTO", status: 504 };
    }
    return {
      ok: false,
      error: "Failed to fetch listing detail",
      status: htmlResult.status ?? 500,
    };
  }

  const html = htmlResult.html;

  const jsonLdObjects = extractJsonLd(html);
  let parsed = extractFromJsonLd(jsonLdObjects);

  if (!parsed) {
    parsed = extractFromHtml(html);
  }

  if (!parsed || !parsed.brand || !parsed.model || parsed.price_czk == null) {
    return { ok: false, error: "Could not parse listing", status: 500 };
  }

  const supabase = getSupabaseAdmin();

  const now = new Date().toISOString();
  const engine_raw =
    [parsed.trim, parsed.brand, parsed.model, parsed.fuel, parsed.transmission]
      .filter(Boolean)
      .map(String)
      .join(" ")
      .trim() || null;
  const brandDisplay = normalizeBrandForDb(parsed.brand) ?? parsed.brand;
  const row: MarketObservationInsert = {
    source: "sauto",
    brand: brandDisplay,
    model: parsed.model,
    model_key: parsed.model_key!,
    trim: parsed.trim ?? null,
    fuel: parsed.fuel ?? null,
    transmission: parsed.transmission ?? null,
    engine_raw,
    year: parsed.year ?? null,
    mileage_km: parsed.mileage_km ?? null,
    price_czk: parsed.price_czk!,
    region: parsed.region ?? null,
    source_listing_id,
    observed_at: now,
    observed_day: now.slice(0, 10),
    last_seen_at: now,
    active: true,
  };

  const result = await upsertMarketObservationRow(supabase, row);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.skipped ? 200 : 500,
    };
  }
  return { ok: true };
}

