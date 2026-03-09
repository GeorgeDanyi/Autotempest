import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminRequestAuthorized, unauthorizedJson } from "@/lib/api/adminAuth";

export const runtime = "nodejs";

const MAX_ROWS_FOR_AGGREGATION = 50_000;

function getEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon };
}

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return unauthorizedJson();

  const { url, anon } = getEnv();
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  try {
    const [obsCountRes, obsLastRes, obsModelsRes, cacheCountRes, cacheLastRes, historyCountRes, historyLastRes] =
      await Promise.all([
        supabase.from("market_observations").select("*", { count: "exact", head: true }),
        supabase
          .from("market_observations")
          .select("observed_at")
          .order("observed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("market_observations")
          .select("model_key")
          .limit(MAX_ROWS_FOR_AGGREGATION),
        supabase.from("price_index_cache").select("*", { count: "exact", head: true }),
        supabase
          .from("price_index_cache")
          .select("computed_at")
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("price_history").select("*", { count: "exact", head: true }),
        supabase
          .from("price_history")
          .select("computed_at")
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const totalObservations = obsCountRes.count ?? 0;
    const lastObservationAt =
      obsLastRes.data && obsLastRes.data.observed_at != null
        ? (obsLastRes.data as { observed_at: string }).observed_at
        : null;
    const uniqueModels = (() => {
      const rows = (obsModelsRes.data ?? []) as { model_key: string | null }[];
      const counts = new Map<string, number>();
      for (const r of rows) {
        const k = r.model_key ?? "";
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const top10 = Array.from(counts.entries())
        .filter(([k]) => k !== "")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([model_key, count]) => ({ model_key, count }));
      const lowData = Array.from(counts.entries())
        .filter(([k]) => k !== "" && counts.get(k)! < 5)
        .map(([model_key, count]) => ({ model_key, count }));
      return {
        count: counts.size,
        top10,
        lowData,
      };
    })();

    const totalPriceIndexRows = cacheCountRes.count ?? 0;
    const lastPriceIndexAt =
      cacheLastRes.data && cacheLastRes.data.computed_at != null
        ? (cacheLastRes.data as { computed_at: string }).computed_at
        : null;

    const totalPriceHistoryRows = historyCountRes.count ?? 0;
    const lastHistoryAt =
      historyLastRes.data && historyLastRes.data.computed_at != null
        ? (historyLastRes.data as { computed_at: string }).computed_at
        : null;

    return NextResponse.json({
      ok: true,
      total_observations: totalObservations,
      unique_models: uniqueModels.count,
      last_observation_at: lastObservationAt,
      total_price_index_rows: totalPriceIndexRows,
      last_price_index_at: lastPriceIndexAt,
      total_price_history_rows: totalPriceHistoryRows,
      last_history_at: lastHistoryAt,
      top_models: uniqueModels.top10,
      low_data_models: uniqueModels.lowData,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
