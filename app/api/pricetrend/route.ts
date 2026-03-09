import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon };
}

function daysForRange(range: string): number {
  switch (range) {
    case "3m":
      return 90;
    case "6m":
      return 180;
    case "12m":
      return 365;
    default:
      return 180;
  }
}

type HistoryRow = {
  model_key: string;
  bucket: string;
  median_price_czk: number | null;
  computed_at: string | null;
};

/** Agregace po měsících: za každý měsíc použij poslední záznam (nejnovější medián). */
function aggregateByMonth(rows: HistoryRow[]): { date: string; median_price_czk: number }[] {
  const byMonth = new Map<string, { computed_at: string; median_price_czk: number }>();

  for (const row of rows) {
    const price = row.median_price_czk;
    if (price == null || !Number.isFinite(price)) continue;
    const at = row.computed_at ?? "";
    if (!at) continue;
    const monthKey = at.slice(0, 7);
    const existing = byMonth.get(monthKey);
    if (!existing || at > existing.computed_at) {
      byMonth.set(monthKey, { computed_at: at, median_price_czk: price });
    }
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { median_price_czk }]) => ({ date, median_price_czk }));
}

export async function GET(req: NextRequest) {
  const { url, anon } = getEnv();
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
  }

  const searchParams = req.nextUrl.searchParams;
  const model_key = searchParams.get("model_key")?.trim() ?? "";
  const resolved_bucket = searchParams.get("resolved_bucket")?.trim() ?? "all";
  const range = searchParams.get("range")?.trim() || "6m";

  if (!model_key) {
    return NextResponse.json({ ok: false, error: "model_key required" }, { status: 400 });
  }

  const days = daysForRange(range);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("price_history")
    .select("model_key, bucket, median_price_czk, computed_at")
    .eq("model_key", model_key)
    .eq("bucket", resolved_bucket)
    .gte("computed_at", sinceIso)
    .order("computed_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as HistoryRow[];
  const points = aggregateByMonth(rows);

  return NextResponse.json({
    ok: true,
    model_key,
    bucket: resolved_bucket,
    points,
  });
}
