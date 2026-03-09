import { getSupabaseAdmin } from "@/lib/supabase/admin";

type IngestSource = "sauto";

export type EnqueueStatus = "queued" | "already_exists";

export async function enqueueIngestJob(params: {
  source: IngestSource;
  source_listing_id: string;
}): Promise<{ ok: true; status: EnqueueStatus } | { ok: false; error: string }> {
  const { source, source_listing_id } = params;

  if (!source_listing_id) {
    return { ok: false, error: "source_listing_id required" };
  }

  const supabase = getSupabaseAdmin();

  const existingRes = await supabase
    .from("ingest_queue")
    .select("id, status, attempts")
    .eq("source", source)
    .eq("source_listing_id", source_listing_id)
    .maybeSingle();

  if (existingRes.error && existingRes.error.code !== "PGRST116") {
    return { ok: false, error: existingRes.error.message };
  }

  const existing = existingRes.data as
    | {
        id: string;
        status: string;
        attempts: number;
      }
    | null;

  const nowIso = new Date().toISOString();

  if (!existing) {
    const insertRes = await supabase
      .from("ingest_queue")
      .insert({
        source,
        source_listing_id,
        status: "queued",
        attempts: 0,
        next_run_at: nowIso,
      })
      .select("id")
      .maybeSingle();

    if (insertRes.error) {
      return { ok: false, error: insertRes.error.message };
    }

    return { ok: true, status: "queued" };
  }

  if (existing.status === "failed") {
    const updateRes = await supabase
      .from("ingest_queue")
      .update({
        status: "queued",
        next_run_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", existing.id);

    if (updateRes.error) {
      return { ok: false, error: updateRes.error.message };
    }

    return { ok: true, status: "queued" };
  }

  return { ok: true, status: "already_exists" };
}

export function computeBackoffMs(attempts: number): number {
  const scheduleSeconds = [10, 30, 120, 300, 900, 1800];
  const idx = Math.min(attempts, scheduleSeconds.length - 1);
  return scheduleSeconds[idx] * 1000;
}

// Test checklist:
// - URL, která je už v DB → 200 ok + market
// - URL, která není v DB → 202 pending
// - zavolám admin process queue → job done
// - opakuju /api/deal → 200 ok + listing
// - při timeoutu/failed → job failed + next_run_at posunutý

