import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runSautoBulkIngest } from "@/lib/ingest/ingestSautoBulk";
import { rebuildPriceIndex } from "@/lib/pricing/rebuildPriceIndex";
import { isAdminRequestAuthorized, unauthorizedJson } from "@/lib/api/adminAuth";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/cron/market-crawler
 * Runs SAUTO bulk ingest then price index rebuild. Idempotent.
 * Protected: x-admin-secret: <ADMIN_API_SECRET>
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return unauthorizedJson();

  try {
    const ingestResult = await runSautoBulkIngest({
      brands: true,
      pages: 5,
    });

    const supabase = getSupabaseAdmin();
    const rebuildResult = await rebuildPriceIndex(supabase);

    return NextResponse.json({
      ok: true,
      status: "ok",
      pagesFetched: ingestResult.pagesFetched,
      parsedListings: ingestResult.parsedListings,
      inserted: ingestResult.inserted,
      skippedExisting: ingestResult.skippedExisting,
      priceIndexBuckets: rebuildResult.upserted,
      brandsProcessed: ingestResult.brandsProcessed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
