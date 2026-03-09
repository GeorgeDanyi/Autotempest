/**
 * Označí inzeráty jako inactive, pokud nebyly viděny X dní (last_seen_at).
 * Připraveno pro cron / ruční spuštění. Volitelně lze filtrovat podle source a smazat velmi staré záznamy.
 *
 * Usage:
 *   npx tsx lib/maintenance/cleanupInactiveListings.ts [--source=sauto] [--stale-days=7] [--delete-after-days=30]
 */

import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_STALE_DAYS = 7;
const DEFAULT_DELETE_AFTER_DAYS = 30;

export type CleanupInactiveListingsOptions = {
  /** Počet dní bez vidění → označit active = false. */
  staleDays?: number;
  /** Pokud je nastaveno, smazat záznamy starší než toto (dny). */
  deleteAfterDays?: number;
  /** Jen pro daný source (sauto, tipcars); bez hodnoty = všechny zdroje. */
  source?: string;
};

export type CleanupInactiveListingsResult = {
  inactiveMarked: number;
  deleted: number;
  sourceFilter: string | null;
  staleDays: number;
};

/**
 * Označí inzeráty jako inactive, kde last_seen_at < now() - staleDays.
 * Volitelně smaže záznamy starší než deleteAfterDays.
 */
export async function cleanupInactiveListings(
  supabase: SupabaseClient,
  options: CleanupInactiveListingsOptions = {}
): Promise<CleanupInactiveListingsResult> {
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
  const deleteAfterDays = options.deleteAfterDays;
  const source = options.source?.trim() || null;

  const now = Date.now();
  const staleThreshold = new Date(
    now - staleDays * 24 * 60 * 60 * 1000
  ).toISOString();

  let query = supabase
    .from("market_observations")
    .update({ active: false })
    .lt("last_seen_at", staleThreshold)
    .eq("active", true);

  if (source) {
    query = query.eq("source", source);
  }

  const { data: marked, error: updateError } = await query.select("id");

  if (updateError) {
    throw new Error(`cleanupInactiveListings update: ${updateError.message}`);
  }

  const inactiveMarked = marked?.length ?? 0;

  let deleted = 0;
  if (deleteAfterDays != null && deleteAfterDays > 0) {
    const deleteThreshold = new Date(
      now - deleteAfterDays * 24 * 60 * 60 * 1000
    ).toISOString();

    let deleteQuery = supabase
      .from("market_observations")
      .delete()
      .lt("last_seen_at", deleteThreshold);

    if (source) {
      deleteQuery = deleteQuery.eq("source", source);
    }

    const { data: removed, error: deleteError } = await deleteQuery.select("id");

    if (deleteError) {
      throw new Error(`cleanupInactiveListings delete: ${deleteError.message}`);
    }
    deleted = removed?.length ?? 0;
  }

  return {
    inactiveMarked,
    deleted,
    sourceFilter: source,
    staleDays,
  };
}

/**
 * CLI: npx tsx lib/maintenance/cleanupInactiveListings.ts [--source=sauto] [--stale-days=7] [--delete-after-days=30]
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let source: string | undefined;
  let staleDays = DEFAULT_STALE_DAYS;
  let deleteAfterDays: number | undefined;

  for (const arg of args) {
    if (arg.startsWith("--source=")) {
      source = arg.slice("--source=".length).trim() || undefined;
    } else if (arg.startsWith("--stale-days=")) {
      const n = parseInt(arg.slice("--stale-days=".length), 10);
      if (Number.isFinite(n) && n > 0) staleDays = n;
    } else if (arg.startsWith("--delete-after-days=")) {
      const n = parseInt(arg.slice("--delete-after-days=".length), 10);
      if (Number.isFinite(n) && n > 0) deleteAfterDays = n;
    }
  }

  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  const result = await cleanupInactiveListings(supabase, {
    source,
    staleDays,
    deleteAfterDays,
  });

  console.error("[cleanupInactiveListings]");
  console.error(`inactiveMarked=${result.inactiveMarked}`);
  console.error(`deleted=${result.deleted}`);
  console.error(`sourceFilter=${result.sourceFilter ?? "(all)"}`);
  console.error(`staleDays=${result.staleDays}`);
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
