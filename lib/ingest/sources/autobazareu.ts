import { fetchAutobazarEuListings } from "@/lib/ingest/autobazareu/fetchListings";
import { saveObservations } from "@/lib/ingest/saveObservations";
import { normalizeObservation } from "@/lib/ingest/normalizeObservation";
import { buildModelKey } from "@/lib/ingest/textNormalize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const EUR_TO_CZK = 25.0;

export async function runAutobazarEuIngest(params: {
  brand: string;
  model: string;
  pages: number;
}): Promise<{ inserted: number; updated: number }> {
  const supabase = getSupabaseAdmin();
  const listings = await fetchAutobazarEuListings(params);

  const rawObservations = listings.map((l) => {
    const modelKey =
      l.brand && l.model ? buildModelKey(l.brand, l.model) : null;
    console.log(
      `[autobazareu][normalize] id=${l.source_listing_id} brand=${l.brand} model=${l.model} modelKey=${modelKey} price_czk=${l.price_eur ? Math.round(l.price_eur * EUR_TO_CZK) : null} year=${l.year} mileage=${l.mileage_km}`,
    );
    return normalizeObservation({
      source: "autobazareu",
      source_listing_id: l.source_listing_id,
      source_url: l.url,
      title: l.title,
      model_key: modelKey ?? undefined,
      brand: l.brand ?? undefined,
      model: l.model ?? undefined,
      price_czk: l.price_eur
        ? Math.round(l.price_eur * EUR_TO_CZK)
        : 0,
      year: l.year ?? undefined,
      mileage_km: l.mileage_km ?? undefined,
      fuel: l.fuel ?? undefined,
      transmission: l.transmission ?? undefined,
      power_kw: undefined,
      observed_at: new Date().toISOString(),
    });
  });

  const observations = rawObservations.filter(
    (o): o is NonNullable<typeof o> => o != null,
  );

  console.log(
    `[autobazareu] listings=${listings.length} normalized=${observations.length}`,
  );

  if (observations.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const result = await saveObservations(supabase, observations);
  return {
    inserted: result?.inserted ?? 0,
    updated: result?.updated ?? 0,
  };
}

