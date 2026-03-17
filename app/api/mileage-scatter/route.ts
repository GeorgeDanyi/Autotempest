import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/** Parsed filters from resolved_bucket (same semantics as pricing system). */
type BucketFilters = {
  yearFrom?: number;
  yearTo?: number;
  engineKey?: string | null;
  mileageMin?: number;
  mileageMax?: number;
};

/**
 * Parse resolved_bucket string (format: year_*__engine_*__mileage_*) into DB filters.
 * Uses same year/mileage bounds as lib/pricing/buckets and marketShape.
 */
function parseBucketToFilters(bucket: string | null | undefined): BucketFilters {
  const out: BucketFilters = {};
  if (!bucket || bucket === "all") return out;

  const parts = bucket.split("__");
  for (const part of parts) {
    if (part.startsWith("year_")) {
      if (part === "unknown_year") continue;
      if (part === "year_2022_plus") {
        out.yearFrom = 2022;
        continue;
      }
      const match = part.match(/^year_(\d{4})_(\d{4})$/) ?? part.match(/^year_(\d{4})_plus$/);
      if (match) {
        out.yearFrom = parseInt(match[1], 10);
        out.yearTo = match[2] ? parseInt(match[2], 10) : undefined;
      }
      continue;
    }
    if (part.startsWith("engine_")) {
      const key = part.slice(7).trim();
      if (key) out.engineKey = key;
      continue;
    }
    if (part.startsWith("mileage_")) {
      if (part === "unknown_mileage") continue;
      const ranges: Record<string, [number, number]> = {
        mileage_0_50k: [0, 50_000],
        mileage_50_100k: [50_000, 100_000],
        mileage_100_150k: [100_000, 150_000],
        mileage_150_200k: [150_000, 200_000],
        mileage_200_250k: [200_000, 250_000],
        mileage_250k_plus: [250_000, 10_000_000],
      };
      const range = ranges[part as keyof typeof ranges];
      if (range) {
        out.mileageMin = range[0];
        out.mileageMax = range[1];
      }
    }
  }
  return out;
}

function getEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon };
}

export type MileageScatterPoint = {
  mileage_km: number;
  price_czk: number;
  year: number | null;
  engine_key: string | null;
  fuel: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const { url, anon } = getEnv();
    if (!url || !anon) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env" },
        { status: 500 },
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const model_key = searchParams.get("model_key")?.trim() ?? "";
    const resolved_bucket = searchParams.get("resolved_bucket")?.trim() ?? null;
    const mileageFromParam = searchParams.get("mileageFrom")?.trim() ?? searchParams.get("mileage_from")?.trim() ?? null;
    const mileageToParam = searchParams.get("mileageTo")?.trim() ?? searchParams.get("mileage_max")?.trim() ?? searchParams.get("mileage_km")?.trim() ?? null;
    const engineParam = searchParams.get("engine")?.trim() || null;
    const fuelParam = searchParams.get("fuel")?.trim() || null;
    const limitParam = searchParams.get("limit")?.trim();
    const limit = Math.min(
      limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    if (!model_key) {
      return NextResponse.json(
        { ok: false, error: "Missing model_key" },
        { status: 400 },
      );
    }

    const filters = parseBucketToFilters(resolved_bucket);
    const yearFromParam = searchParams.get("yearFrom")?.trim() ?? null;
    const yearToParam = searchParams.get("yearTo")?.trim() ?? null;
    const yearFromNum = yearFromParam ? parseInt(yearFromParam.replace(/\D/g, ""), 10) : null;
    const yearToNum = yearToParam ? parseInt(yearToParam.replace(/\D/g, ""), 10) : null;
    const effectiveYearFrom = yearFromNum != null && !Number.isNaN(yearFromNum) ? yearFromNum : filters.yearFrom;
    const effectiveYearTo = yearToNum != null && !Number.isNaN(yearToNum) ? yearToNum : filters.yearTo;
    const engine_key = engineParam ?? filters.engineKey ?? null;
    const fuel = fuelParam ?? null;

    const mileageFromNum =
      mileageFromParam != null && mileageFromParam !== ""
        ? parseInt(mileageFromParam.replace(/\D/g, ""), 10)
        : null;
    const mileageToNum =
      mileageToParam != null && mileageToParam !== ""
        ? parseInt(mileageToParam.replace(/\D/g, ""), 10)
        : null;
    const hasExplicitMileage =
      (mileageFromNum != null && !Number.isNaN(mileageFromNum)) ||
      (mileageToNum != null && !Number.isNaN(mileageToNum));

    const supabase = createClient(url, anon, { auth: { persistSession: false } });

    let query = supabase
      .from("market_observations")
      .select("mileage_km, price_czk, year, engine_key, fuel")
      .eq("model_key", model_key)
      .eq("active", true)
      .not("mileage_km", "is", null)
      .not("price_czk", "is", null);

    if (effectiveYearFrom != null) query = query.gte("year", effectiveYearFrom);
    if (effectiveYearTo != null) query = query.lte("year", effectiveYearTo);
    if (engine_key) query = query.eq("engine_key", engine_key);
    if (fuel) query = query.eq("fuel", fuel);
    if (hasExplicitMileage) {
      if (mileageFromNum != null && !Number.isNaN(mileageFromNum)) query = query.gte("mileage_km", mileageFromNum);
      if (mileageToNum != null && !Number.isNaN(mileageToNum)) query = query.lte("mileage_km", mileageToNum);
    } else {
      if (filters.mileageMin != null) query = query.gte("mileage_km", filters.mileageMin);
      if (filters.mileageMax != null) query = query.lt("mileage_km", filters.mileageMax);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as Array<{
      mileage_km: number | null;
      price_czk: number | null;
      year: number | null;
      engine_key: string | null;
      fuel: string | null;
    }>;

    const points: MileageScatterPoint[] = rows
      .filter(
        (r) =>
          r.mileage_km != null &&
          Number.isFinite(r.mileage_km) &&
          r.price_czk != null &&
          Number.isFinite(r.price_czk),
      )
      .map((r) => ({
        mileage_km: r.mileage_km as number,
        price_czk: r.price_czk as number,
        year: r.year ?? null,
        engine_key: r.engine_key ?? null,
        fuel: r.fuel ?? null,
      }));

    return NextResponse.json({
      ok: true,
      points,
      count: points.length,
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: err.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
