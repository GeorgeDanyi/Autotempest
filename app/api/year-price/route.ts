import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon };
}

function percentileCont(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) throw new Error("percentileCont: empty array");
  if (n === 1) return sorted[0]!;
  const index = (n - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * weight;
}

function normalizeFuel(f: string): string[] {
  const lower = f.toLowerCase();
  if (lower === "benzin" || lower === "petrol" || lower === "benzín") {
    return ["benzin", "petrol", "Benzín", "benzín", "Petrol"];
  }
  if (lower === "diesel") {
    return ["diesel", "Diesel"];
  }
  if (lower === "hybrid" || lower === "hybridní") {
    return ["hybrid", "Hybrid", "hybridní", "Hybridní"];
  }
  if (lower === "elektro" || lower === "electric") {
    return ["elektro", "Elektro", "electric", "Electric"];
  }
  return [f, f.toLowerCase(), f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()];
}

export async function GET(req: NextRequest) {
  try {
    const { url, anon } = getEnv();
    if (!url || !anon) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env" },
        { status: 500 },
      );
    }

    const model_key = req.nextUrl.searchParams.get("model_key")?.trim() ?? "";
    const fuel = req.nextUrl.searchParams.get("fuel")?.trim() || null;
    const engine = req.nextUrl.searchParams.get("engine")?.trim() || null;

    if (!model_key) {
      return NextResponse.json(
        { ok: false, error: "Missing model_key" },
        { status: 400 },
      );
    }

    const supabase = createClient(url, anon, { auth: { persistSession: false } });

    let query = supabase
      .from("market_observations")
      .select("year, price_czk")
      .eq("model_key", model_key)
      .eq("active", true)
      .not("year", "is", null)
      .not("price_czk", "is", null);

    if (fuel) query = query.in("fuel", normalizeFuel(fuel));
    if (engine) query = query.eq("engine_key", engine);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as Array<{
      year: number | null;
      price_czk: number | null;
    }>;

    const byYear = new Map<number, number[]>();
    for (const row of rows) {
      if (
        row.year == null ||
        !Number.isFinite(row.year) ||
        row.price_czk == null ||
        !Number.isFinite(row.price_czk)
      ) {
        continue;
      }
      const list = byYear.get(row.year) ?? [];
      list.push(row.price_czk);
      byYear.set(row.year, list);
    }

    const result = Array.from(byYear.entries())
      .map(([year, prices]) => {
        const sorted = prices.slice().sort((a, b) => a - b);
        return {
          year,
          median_price_czk: Math.round(percentileCont(sorted, 0.5)),
          sample_size: sorted.length,
        };
      })
      .filter((row) => row.sample_size >= 3)
      .sort((a, b) => a.year - b.year);

    return NextResponse.json({
      ok: true,
      model_key,
      data: result,
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
