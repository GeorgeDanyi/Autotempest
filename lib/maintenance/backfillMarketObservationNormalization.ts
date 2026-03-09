import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isBrandOnlyOrGenericModelKey,
  normalizeModelKey,
} from "@/lib/cars/normalizeModel";
import { detectEngineKey } from "@/lib/ingest/detectEngineKey";

type MarketObservationRow = {
  id: number;
  brand: string | null;
  model: string | null;
  trim: string | null;
  fuel: string | null;
  transmission: string | null;
  source_listing_id: string | null;
  model_key: string | null;
  engine_key: string | null;
};

export type BackfillNormalizationResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

async function backfillMarketObservationNormalization(
  supabase: SupabaseClient,
  options: { dryRun: boolean; batchSize?: number } = { dryRun: true },
): Promise<BackfillNormalizationResult> {
  const batchSize = options.batchSize && options.batchSize > 0 ? options.batchSize : 500;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let lastId: number | null = null;

  const examples: {
    id: number;
    source_listing_id: string | null;
    old_model_key: string | null;
    new_model_key: string | null;
    old_engine_key: string | null;
    new_engine_key: string | null;
  }[] = [];

  // Paginate by primary key id to be safe on large tables
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase
      .from("market_observations")
      .select(
        "id, brand, model, trim, fuel, transmission, source_listing_id, model_key, engine_key",
      )
      .order("id", { ascending: true })
      .limit(batchSize);

    if (lastId != null) {
      query = query.gt("id", lastId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`backfillNormalization: select failed: ${error.message}`);
    }

    const rows = (data ?? []) as MarketObservationRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      lastId = row.id;

      // Recompute normalized model_key using current helper
      let nextModelKey = normalizeModelKey({
        brand: row.brand,
        model: row.model,
        trim: row.trim,
      });

      // Safeguard against downgrades to brand-only / generic keys.
      if (
        nextModelKey &&
        row.model_key &&
        nextModelKey.length < row.model_key.length &&
        isBrandOnlyOrGenericModelKey(nextModelKey)
      ) {
        nextModelKey = null;
      }

      const effectiveModelKey = nextModelKey ?? row.model_key;
      const modelChanged =
        effectiveModelKey != null && effectiveModelKey !== row.model_key;

      // Recompute engine_key only when missing, using current detection helper
      let recomputedEngineKey: string | null = row.engine_key;
      if (!row.engine_key) {
        const parts: string[] = [];
        if (row.trim) parts.push(row.trim);
        if (row.brand) parts.push(row.brand);
        if (row.model) parts.push(row.model);
        if (row.fuel) parts.push(row.fuel);
        if (row.transmission) parts.push(row.transmission);
        const text = parts.join(" ").trim();
        if (text) {
          const detected = detectEngineKey(text);
          if (detected) {
            recomputedEngineKey = detected;
          }
        }
      }

      const engineChanged =
        row.engine_key == null && recomputedEngineKey != null;

      if (!modelChanged && !engineChanged) {
        skipped += 1;
        continue;
      }

      if (examples.length < 20) {
        examples.push({
          id: row.id,
          source_listing_id: row.source_listing_id,
          old_model_key: row.model_key,
          new_model_key: effectiveModelKey ?? row.model_key,
          old_engine_key: row.engine_key,
          new_engine_key: recomputedEngineKey,
        });
      }

      if (!options.dryRun) {
        const updatePayload: Partial<MarketObservationRow> = {};
        if (modelChanged && effectiveModelKey != null) {
          updatePayload.model_key = effectiveModelKey;
        }
        if (engineChanged && recomputedEngineKey != null) {
          updatePayload.engine_key = recomputedEngineKey;
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateError } = await supabase
            .from("market_observations")
            .update(updatePayload)
            .eq("id", row.id);

          if (updateError) {
            console.error("[backfillNormalization:error]", {
              id: row.id,
              source_listing_id: row.source_listing_id,
              error: updateError.message ?? String(updateError),
            });
            skipped += 1;
            continue;
          }

          updated += 1;
        } else {
          skipped += 1;
        }
      } else {
        // Dry-run: count rows that would be updated.
        updated += 1;
      }
    }
  }

  console.error(
    `[backfillNormalization] scanned=${scanned} updated=${updated} skipped=${skipped}`,
  );

  if (options.dryRun) {
    console.error("[backfillNormalization] dry-run examples (first 20):");
    for (const ex of examples) {
      console.error(
        JSON.stringify(
          {
            id: ex.id,
            source_listing_id: ex.source_listing_id,
            model_key: {
              old: ex.old_model_key,
              next: ex.new_model_key,
            },
            engine_key: {
              old: ex.old_engine_key,
              next: ex.new_engine_key,
            },
          },
          null,
          2,
        ),
      );
    }
  }

  return { scanned, updated, skipped };
}

/**
 * CLI usage examples:
 *
 * Dry run:
 *   npx tsx ./lib/maintenance/backfillMarketObservationNormalization.ts --dry-run
 *
 * Live mode:
 *   npx tsx ./lib/maintenance/backfillMarketObservationNormalization.ts
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = getSupabaseAdmin();

  await backfillMarketObservationNormalization(supabase, { dryRun });
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

