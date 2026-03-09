import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";

const STALE_DAYS_MARK_INACTIVE = 7;
const STALE_DAYS_DELETE = 30;

export type CleanupStaleListingsResult = {
  inactiveMarked: number;
  deleted: number;
};

/**
 * Mark listings not seen for 7 days as inactive, optionally delete those
 * not seen for 30 days. Price index rebuild uses only active = true.
 */
export async function cleanupStaleListings(
  supabase: SupabaseClient,
  options?: { deleteOld?: boolean },
): Promise<CleanupStaleListingsResult> {
  const now = Date.now();
  const sevenDaysAgo = new Date(
    now - STALE_DAYS_MARK_INACTIVE * 24 * 60 * 60 * 1000,
  ).toISOString();
  const thirtyDaysAgo = new Date(
    now - STALE_DAYS_DELETE * 24 * 60 * 60 * 1000,
  ).toISOString();

  // 1. Mark inactive: last_seen_at < 7 days ago
  const { data: marked, error: updateError } = await supabase
    .from("market_observations")
    .update({ active: false })
    .lt("last_seen_at", sevenDaysAgo)
    .eq("active", true)
    .select("id");

  if (updateError) {
    throw new Error(`cleanupStaleListings update: ${updateError.message}`);
  }

  const inactiveMarked = marked?.length ?? 0;

  let deleted = 0;
  if (options?.deleteOld) {
    // 2. Delete very old: last_seen_at < 30 days ago
    const { data: removed, error: deleteError } = await supabase
      .from("market_observations")
      .delete()
      .lt("last_seen_at", thirtyDaysAgo)
      .select("id");

    if (deleteError) {
      throw new Error(`cleanupStaleListings delete: ${deleteError.message}`);
    }
    deleted = removed?.length ?? 0;
  }

  return { inactiveMarked, deleted };
}

/**
 * CLI runner: npx tsx lib/maintenance/cleanupStaleListings.ts [--delete-old]
 */
async function main(): Promise<void> {
  const deleteOld = process.argv.includes("--delete-old");

  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await cleanupStaleListings(supabase, { deleteOld });

  console.error("[cleanupStaleListings]");
  console.error(`inactiveMarked=${result.inactiveMarked}`);
  console.error(`deleted=${result.deleted}`);
}

const __filename = fileURLToPath(import.meta.url);
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  resolve(process.argv[1]) === resolve(__filename);
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
