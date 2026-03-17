import { getSupabaseAdmin } from "@/lib/supabase/admin";

const TUTUT_MODELS: Record<string, string[]> = {
  skoda: ["octavia", "fabia", "superb", "karoq", "kodiaq", "scala", "kamiq", "rapid", "yeti"],
  volkswagen: ["golf", "passat", "tiguan", "polo", "touran", "caddy", "t-roc", "t-cross"],
  bmw: ["3er", "5er", "x3", "x5", "1er", "2er", "x1"],
  audi: ["a4", "a6", "a3", "q5", "q3", "a5"],
  mercedes: ["c-class", "e-class", "a-class", "glc", "gle"],
  toyota: ["corolla", "yaris", "rav4", "auris"],
  ford: ["focus", "fiesta", "mondeo", "kuga", "puma"],
  hyundai: ["i30", "tucson", "i20", "kona", "santa-fe"],
  kia: ["ceed", "sportage", "sorento", "niro", "stinger"],
  opel: ["astra", "insignia", "mokka", "crossland"],
  renault: ["megane", "clio", "kadjar", "captur"],
  peugeot: ["308", "3008", "208", "2008", "508"],
};

const FUEL_MAP: Record<string, string> = {
  benzin: "petrol",
  benzín: "petrol",
  nafta: "diesel",
  diesel: "diesel",
  elektro: "electric",
  elektřina: "electric",
  hybrid: "hybrid",
  lpg: "lpg",
  cng: "cng",
};

const BRAND_SLUG_MAP: Record<string, string> = {
  skoda: "skoda",
  volkswagen: "volkswagen",
  bmw: "bmw",
  audi: "audi",
  mercedes: "mercedes-benz",
  toyota: "toyota",
  ford: "ford",
  hyundai: "hyundai",
  kia: "kia",
  opel: "opel",
  renault: "renault",
  peugeot: "peugeot",
};

function parseDescription(desc: string): { mileage: number | null; year: number | null; fuel: string | null } {
  const mileageMatch = desc.match(/Najeto:\s*([\d\s]+)\s*km/i);
  const yearMatch = desc.match(/rok výroby:\s*(\d{4})/i);
  const fuelMatch = desc.match(/palivo:\s*(\w+)/i);

  const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/\s/g, ""), 10) : null;
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const fuelRaw = fuelMatch ? fuelMatch[1].toLowerCase() : null;
  const fuel = fuelRaw ? (FUEL_MAP[fuelRaw] ?? null) : null;

  return { mileage, year, fuel };
}

function normalizeModelKey(brand: string, model: string): string {
  const b = brand.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const m = model.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `${b}_${m}`;
}

async function fetchListingIds(brand: string, model: string, page = 1): Promise<string[]> {
  const slug = BRAND_SLUG_MAP[brand] ?? brand;
  const url = `https://www.tutut.cz/inzeraty/${slug}/${model}?page=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return [];
  const html = await res.text();
  const matches = html.matchAll(/href="(\/inzerat\/[^"]+)"/g);
  const ids: string[] = [];
  for (const m of matches) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

async function fetchListing(path: string): Promise<{
  external_id: string;
  price_czk: number;
  mileage_km: number | null;
  year: number | null;
  fuel: string | null;
  brand: string | null;
  model_key: string | null;
  source_url: string;
  title: string | null;
} | null> {
  const url = `https://www.tutut.cz${path}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const html = await res.text();

    // Parsuj JSON-LD
    const scripts = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    for (const script of scripts) {
      try {
        const data = JSON.parse(script[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "Product" && item.offers?.price) {
            const { mileage, year, fuel } = parseDescription(item.description ?? "");
            const brandName = item.brand?.name ?? null;
            const brandKey = brandName?.toLowerCase().replace(/[^a-z]/g, "") ?? null;

            // Extrahuj model z URL
            const modelMatch = path.match(/\/inzerat\/([a-z]+)-([a-z0-9-]+)-/);
            const modelSlug = modelMatch ? modelMatch[2] : null;
            const model_key = brandKey && modelSlug
              ? normalizeModelKey(brandKey, modelSlug.split("-")[0])
              : null;

            return {
              external_id: `tutut_${path.split("/").pop()}`,
              price_czk: item.offers.price,
              mileage_km: mileage,
              year,
              fuel,
              brand: brandKey,
              model_key,
              source_url: url,
              title: item.name ?? null,
            };
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function crawlTutut(pages = 2): Promise<{ inserted: number; skipped: number; errors: number }> {
  const supabase = getSupabaseAdmin();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const [brand, models] of Object.entries(TUTUT_MODELS)) {
    for (const model of models) {
      for (let page = 1; page <= pages; page++) {
        const paths = await fetchListingIds(brand, model, page);
        if (paths.length === 0) break;

        for (const path of paths) {
          try {
            const listing = await fetchListing(path);
            if (!listing || !listing.price_czk || listing.price_czk < 10000) {
              skipped++;
              continue;
            }

            const { error } = await supabase.from("market_observations").upsert(
              {
                source_listing_id: listing.external_id,
                source: "tutut",
                title: listing.title,
                price_czk: listing.price_czk,
                mileage_km: listing.mileage_km,
                year: listing.year,
                fuel: listing.fuel,
                model_key: listing.model_key,
                brand: listing.brand,
                source_url: listing.source_url,
                observed_at: new Date().toISOString(),
                active: true,
              },
              { onConflict: "source,source_listing_id" }
            );

            if (error) {
              errors++;
            } else {
              inserted++;
            }
          } catch {
            errors++;
          }
        }

        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return { inserted, skipped, errors };
}
