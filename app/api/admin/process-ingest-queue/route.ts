import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ingestSautoSingle } from "@/lib/ingest/ingestSautoSingle";
import { computeBackoffMs } from "@/lib/ingest/queue";
import { isAdminRequestAuthorized, unauthorizedJson } from "@/lib/api/adminAuth";

export const runtime = "nodejs";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Intended to be called by cron / scheduler (Supabase scheduled job, Vercel cron, GitHub Actions, ...).
export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  let limit = Number(limitParam ?? "");
  if (!Number.isFinite(limit) || limit <= 0) limit = 5;
  if (limit > 20) limit = 20;

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("ingest_queue")
    .select("id, source, source_listing_id, status, attempts, last_error")
    .in("status", ["queued", "failed"])
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      done: 0,
      failed: 0,
      items: [],
    });
  }

  let processed = 0;
  let done = 0;
  let failed = 0;
  const items: {
    source_listing_id: string;
    status: string;
    attempts: number;
    last_error: string | null;
  }[] = [];

  for (const job of jobs) {
    processed += 1;
    const jobId = job.id as string;
    const source = job.source as string;
    const source_listing_id = job.source_listing_id as string;
    const attempts = (job.attempts as number) ?? 0;

    // Mark as processing
    const startedAt = new Date().toISOString();
    const { error: updateProcessingError } = await supabase
      .from("ingest_queue")
      .update({ status: "processing", updated_at: startedAt })
      .eq("id", jobId);

    if (updateProcessingError) {
      failed += 1;
      items.push({
        source_listing_id,
        status: "failed",
        attempts,
        last_error: updateProcessingError.message,
      });
      continue;
    }

    let finalStatus = "done";
    let finalAttempts = attempts;
    let finalError: string | null = null;

    try {
      if (source !== "sauto") {
        finalStatus = "failed";
        finalAttempts = attempts + 1;
        finalError = "Unsupported source";
      } else {
        const res = await ingestSautoSingle({ source_listing_id });
        if (!res.ok) {
          finalStatus = "failed";
          finalAttempts = attempts + 1;
          finalError = res.error;
        }
      }
    } catch (e: any) {
      finalStatus = "failed";
      finalAttempts = attempts + 1;
      finalError = e?.message ?? "Unknown error during ingest";
    }

    const updatePayload: any = {
      status: finalStatus,
      attempts: finalAttempts,
      updated_at: new Date().toISOString(),
      last_error: finalError,
    };

    if (finalStatus === "failed") {
      const backoffMs = computeBackoffMs(finalAttempts);
      const nextRun = new Date(Date.now() + backoffMs).toISOString();
      updatePayload.next_run_at = nextRun;
    }

    const { error: updateFinalError } = await supabase
      .from("ingest_queue")
      .update(updatePayload)
      .eq("id", jobId);

    if (updateFinalError) {
      failed += 1;
      items.push({
        source_listing_id,
        status: "failed",
        attempts: finalAttempts,
        last_error: updateFinalError.message,
      });
    } else {
      if (finalStatus === "done") {
        done += 1;
      } else {
        failed += 1;
      }
      items.push({
        source_listing_id,
        status: finalStatus,
        attempts: finalAttempts,
        last_error: finalError,
      });
    }

    // Rate limit: 1 request per 2s
    await sleep(2000);
  }

  return NextResponse.json({
    ok: true,
    processed,
    done,
    failed,
    items,
  });
}

