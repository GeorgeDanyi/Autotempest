/**
 * Jednorázový backfill: přepočet engine_key u existujících market_observations (source = sauto).
 * Používá aktuální detectEngineKey(). Primárně text z pole engine, sekundárně title, trim, brand, model, fuel, transmission.
 * Validní engine_key (1_0_tsi, 2_0_tdi, ev, …) se při detekci null nemění; na null se přepisují jen zjevně špatné hodnoty (rs, dsg, scout, …).
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { detectEngineKey } from "@/lib/ingest/detectEngineKey";

const BATCH_SIZE = 500;

/** Validní engine_key – při detekci null tyto hodnoty ponecháme beze změny. */
const VALID_ENGINE_KEYS = new Set([
  "1_0_tsi", "1_2_tsi", "1_4_tsi", "1_5_tsi", "1_8_tsi", "2_0_tsi",
  "1_6_tdi", "1_9_tdi", "2_0_tdi", "3_0_tdi",
  "ev", "hybrid", "phev", "lpg",
]);

/** Zjevně špatné historické hodnoty – při detekci null je přepíšeme na null. */
const OLD_VALUES_TO_NULL = new Set([
  "rs", "dsg", "scout", "style", "ambition", "sportline", "laurin_klement",
  "4x4", "awd", "fwd", "rwd",
]);

type Row = {
  id: number;
  engine_key: string | null;
  engine: string | null;
  title: string | null;
  brand: string | null;
  model: string | null;
  trim: string | null;
  fuel: string | null;
  transmission: string | null;
};

/** Primárně engine, sekundárně title, trim a ostatní textová pole. */
function buildTextForDetection(row: Row): string {
  const parts: string[] = [];
  if (row.engine && String(row.engine).trim()) parts.push(String(row.engine).trim());
  if (row.title && String(row.title).trim()) parts.push(String(row.title).trim());
  if (row.trim) parts.push(row.trim);
  if (row.brand) parts.push(row.brand);
  if (row.model) parts.push(row.model);
  if (row.fuel) parts.push(row.fuel);
  if (row.transmission) parts.push(row.transmission);
  return parts.join(" ").trim();
}

async function main() {
  const supabase = getSupabaseAdmin();

  let scanned = 0;
  let changed = 0;
  let unchanged = 0;
  let nulled_out = 0;
  let lastId: number | null = null;
  const changeCounts = new Map<string, number>();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase
      .from("market_observations")
      .select("id, engine_key, engine, title, brand, model, trim, fuel, transmission")
      .eq("source", "sauto")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId != null) {
      query = query.gt("id", lastId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`backfillEngineKeys: select failed: ${error.message}`);
    }

    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      lastId = row.id;

      const text = buildTextForDetection(row);
      const newKey = text ? detectEngineKey(text) : null;
      const oldKey = row.engine_key != null && row.engine_key !== "" ? row.engine_key : null;
      const oldNorm = oldKey?.toLowerCase().trim() ?? "(null)";
      const newNorm = newKey != null ? newKey : "(null)";

      if (oldNorm === newNorm) {
        unchanged += 1;
        continue;
      }

      // Validní engine_key neměníme na null – detekce mohla selhat (málo textu, jiný formát).
      if (newKey === null && oldKey != null && VALID_ENGINE_KEYS.has(oldNorm)) {
        unchanged += 1;
        continue;
      }

      // Na null přepisujeme jen zjevně špatné historické hodnoty.
      if (newKey === null && !OLD_VALUES_TO_NULL.has(oldNorm)) {
        unchanged += 1;
        continue;
      }

      if (newKey === null && OLD_VALUES_TO_NULL.has(oldNorm)) {
        nulled_out += 1;
      }

      const { error: updateError } = await supabase
        .from("market_observations")
        .update({ engine_key: newKey })
        .eq("id", row.id);

      if (updateError) {
        console.error("[backfillEngineKeys] update error", row.id, updateError.message);
        continue;
      }

      changed += 1;
      const pair = `${oldNorm} -> ${newNorm}`;
      changeCounts.set(pair, (changeCounts.get(pair) ?? 0) + 1);
    }
  }

  console.log("[backfillEngineKeys] scanned=" + scanned);
  console.log("[backfillEngineKeys] changed=" + changed);
  console.log("[backfillEngineKeys] unchanged=" + unchanged);
  console.log("[backfillEngineKeys] nulled_out=" + nulled_out);

  const topChanges = Array.from(changeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  console.log("[backfillEngineKeys] top old -> new:");
  for (const [pair, count] of topChanges) {
    console.log("[backfillEngineKeys]   " + pair + " (count=" + count + ")");
  }
}

main().catch((e) => {
  console.error("[backfillEngineKeys] fatal:", e);
  process.exit(1);
});
