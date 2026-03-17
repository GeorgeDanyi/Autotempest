export interface AutobazarEuListing {
  source_listing_id: string;
  url: string;
  title: string;
  brand: string | null;
  model: string | null;
  price_eur: number | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
}

export async function fetchAutobazarEuListings(params: {
  brand: string;
  model: string;
  pages: number;
}): Promise<AutobazarEuListing[]> {
  const { brand, model, pages } = params;
  const results: AutobazarEuListing[] = [];
  const seen = new Set<string>();
  let firstPageIds: Set<string> | null = null;

  for (let page = 1; page <= pages; page++) {
    const url = `https://www.autobazar.eu/vysledky/osobne-vozidla/${brand}/${model}/strana/${page}/`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept-Language": "cs-CZ,cs;q=0.9",
        },
        signal: AbortSignal.timeout(10_000),
      });
      const html = await res.text();
      console.log(
        `[autobazareu][fetch] url: ${url} html length: ${html.length}`,
      );

      const parsed = parseAutobazarEuList(html, brand, model);

      const parsedIds = parsed
        .map((p) => p.source_listing_id)
        .filter((id): id is string => Boolean(id));
      if (page === 1) {
        firstPageIds = new Set(parsedIds);
      } else if (
        firstPageIds &&
        parsedIds.length > 0 &&
        parsedIds.every((id) => firstPageIds!.has(id))
      ) {
        console.log(
          `[autobazareu][page${page}] detected duplicate page, stopping pagination`,
        );
        break;
      }

      let newCount = 0;
      for (const item of parsed) {
        if (!item.source_listing_id || seen.has(item.source_listing_id))
          continue;
        seen.add(item.source_listing_id);
        results.push(item);
        newCount++;
      }

      console.log(
        `[autobazareu][page${page}] parsed: ${parsed.length} new: ${newCount}`,
      );

      if (parsed.length === 0) break;
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`[autobazareu] error page ${page}:`, e);
      break;
    }
  }

  return results;
}

function parseAutobazarEuList(
  html: string,
  brand: string,
  model: string,
): AutobazarEuListing[] {
  const out: AutobazarEuListing[] = [];
  const seen = new Set<string>();

  // Najdi všechny href na detail stránky
  const detailRe = /href="(\/detail\/[^"]+\/([A-Za-z0-9_\-]{5,})\/?)"/g;

  // Sbírej pozice prvního a druhého výskytu každého ID
  const positions = new Map<string, number[]>();
  let m: RegExpExecArray | null;
  while ((m = detailRe.exec(html))) {
    const id = m[2]!;
    if (!positions.has(id)) positions.set(id, []);
    positions.get(id)!.push(m.index);
  }

  for (const [id, idxs] of positions) {
    if (seen.has(id)) continue;
    seen.add(id);

    // Použij DRUHÝ výskyt pokud existuje, jinak první
    const pos = idxs.length >= 2 ? idxs[1]! : idxs[0]!;
    const ctx = html.slice(pos, pos + 3000);

    const url = `https://www.autobazar.eu/detail/${brand}-${model}/${id}/`;

    // Cena v EUR — formát "19 000 €" nebo "19000 €"
    let price_eur: number | null = null;
    const priceM = ctx.match(/>([\d\s\u00a0]{3,12})\s*€<\/span>/);
    if (priceM) {
      const num = parseInt(priceM[1]!.replace(/[\s\u00a0]/g, ""), 10);
      if (num >= 500 && num <= 500_000) price_eur = num;
    }

    // Rok — z href="/vysledky-parametre/.../octavia/2022/"
    const yearM = ctx.match(/\/vysledky-parametre\/[^"]+\/(20[0-2]\d)\//);
    const year = yearM ? parseInt(yearM[1]!, 10) : null;

    // Km — "79 980 km"
    let mileage_km: number | null = null;
    const kmM = ctx.match(/([\d\s\u00a0]{3,10})\s*km/i);
    if (kmM) {
      const km = parseInt(kmM[1]!.replace(/[\s\u00a0]/g, ""), 10);
      if (km >= 0 && km <= 1_000_000) mileage_km = km;
    }

    // Palivo z href="/vysledky-parametre/.../diesel/"
    const fuelM = ctx.match(
      /\/vysledky-parametre\/[^"]+\/(diesel|benzin|elektr|hybrid|lpg)\//i,
    );
    const fuel = fuelM
      ? fuelM[1]!
          .toLowerCase()
          .replace("benzin", "petrol")
          .replace("elektr", "ev")
      : null;

    // Převodovka
    const transM = ctx.match(
      /\/vysledky-parametre\/[^"]+\/(manual|automat)\//i,
    );
    const transmission = transM ? transM[1]!.toLowerCase() : null;

    out.push({
      source_listing_id: id,
      url,
      title: `${brand} ${model}`,
      brand,
      model,
      price_eur,
      year,
      mileage_km,
      fuel,
      transmission,
    });
  }

  return out;
}

