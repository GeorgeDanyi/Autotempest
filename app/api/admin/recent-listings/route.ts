import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAdminRequestAuthorized, unauthorizedJson } from "@/lib/api/adminAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return unauthorizedJson();

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("market_observations")
    .select("source, source_listing_id, model_key, price_czk, year, mileage_km, observed_at")
    .eq("source", "sauto")
    .order("observed_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    items: data ?? [],
  });
}

