import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const revalidate = 3600; // cache 1 hodinu

export async function GET() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
  });

  // Najdi segment (model_key + year) s nejvíce záznamy
  const { data: topModels } = await supabase
    .from("market_observations")
    .select("model_key, year")
    .not("model_key", "is", null)
    .not("year", "is", null)
    .limit(50000);

  if (!topModels?.length) {
    return NextResponse.json({ ok: false, reason: "no_data" });
  }

  // Spočítej počty pro kombinace model_key + year
  const counts: Record<
    string,
    { model_key: string; year: number; count: number }
  > = {};
  for (const r of topModels) {
    const k = `${r.model_key as string}__${r.year as number}`;
    if (!counts[k]) {
      counts[k] = {
        model_key: r.model_key as string,
        year: r.year as number,
        count: 0,
      };
    }
    counts[k]!.count += 1;
  }

  const MODEL_KEY_BLACKLIST = new Set([
    "bmw_rada",
    "bmw_unknown",
    "land_rover_unknown",
    "mercedes_benz_unknown",
    "aston_martin",
  ]);

  const topSegment = Object.values(counts)
    .filter((s) => !MODEL_KEY_BLACKLIST.has(s.model_key))
    .sort((a, b) => b.count - a.count)[0];

  if (!topSegment) {
    return NextResponse.json({ ok: false, reason: "no_top_model" });
  }

  const topModelKey = topSegment.model_key;
  const topYear = topSegment.year;

  // Získej pricing pro top model + rok (segment)
  const { data: obs } = await supabase
    .from("market_observations")
    .select("price_czk, year, source")
    .eq("model_key", topModelKey)
    .eq("year", topYear)
    .not("price_czk", "is", null)
    .gt("price_czk", 0)
    .limit(2000);

  const prices = (obs ?? [])
    .map((r) => r.price_czk as number)
    .filter((p) => p > 0 && Number.isFinite(p))
    .sort((a, b) => a - b);

  if (prices.length < 3) {
    return NextResponse.json({ ok: false, reason: "insufficient_prices" });
  }

  const median = prices[Math.floor(prices.length * 0.5)]!;
  const p25 = prices[Math.floor(prices.length * 0.25)]!;
  const p75 = prices[Math.floor(prices.length * 0.75)]!;
  const total_count = counts[topModelKey];

  // Formátuj model label (skoda_octavia → Škoda Octavia)
  const BRAND_DISPLAY: Record<string, string> = {
    bmw: "BMW",
    vw: "VW",
    skoda: "Škoda",
    mercedes: "Mercedes-Benz",
    mercedes_benz: "Mercedes-Benz",
    kia: "Kia",
    toyota: "Toyota",
    ford: "Ford",
    audi: "Audi",
    hyundai: "Hyundai",
    volvo: "Volvo",
    peugeot: "Peugeot",
    renault: "Renault",
    seat: "Seat",
    opel: "Opel",
    mazda: "Mazda",
    nissan: "Nissan",
    honda: "Honda",
  };
  const parts = topModelKey.split("_");
  const brandKey = parts[0] ?? "";
  const brandLabel =
    BRAND_DISPLAY[brandKey] ??
    (brandKey.charAt(0).toUpperCase() + brandKey.slice(1));
  const modelLabel = parts
    .slice(1)
    .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  const displayLabel = `${brandLabel} ${modelLabel}`.trim();

  // Počet zdrojů
  const sources = new Set(
    (obs ?? [])
      .map((r) => r.source as string)
      .filter((source): source is string => Boolean(source)),
  );

  return NextResponse.json({
    ok: true,
    model_key: topModelKey,
    year: topYear,
    display_label: displayLabel,
    median_price_czk: median,
    p25_price_czk: p25,
    p75_price_czk: p75,
    sample_size: prices.length,
    total_observations: total_count,
    source_count: sources.size,
    confidence_pct: Math.min(99, Math.round(50 + prices.length / 10)),
  });
}

