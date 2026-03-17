/**
 * Deep crawl script – nakrmí databázi pro všechny hlavní modely.
 * Spusť: npx tsx lib/ingest/runDeepCrawl.ts
 * Nebo konkrétní značku: npx tsx lib/ingest/runDeepCrawl.ts --brand=skoda
 * S více stránkami: npx tsx lib/ingest/runDeepCrawl.ts --pages=50
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { getSupabaseAdmin } from "../supabase/admin";
import { runTipcarsIngest } from "./sources/tipcars";
import { rebuildPriceIndex } from "../pricing/rebuildPriceIndex";
import { ingestSautoPages } from "@/lib/ingest/ingestSautoSingle";
import { runAutobazarEuIngest } from "@/lib/ingest/sources/autobazareu";
import { crawlTutut } from "@/lib/ingest/sources/tutut";
import { deactivateStaleObservations } from "./saveObservations";

const DEEP_CRAWL_TARGETS: Array<{ brand: string; model: string }> = [
  // Škoda
  { brand: "skoda", model: "octavia" },
  { brand: "skoda", model: "superb" },
  { brand: "skoda", model: "fabia" },
  { brand: "skoda", model: "kodiaq" },
  { brand: "skoda", model: "karoq" },
  { brand: "skoda", model: "rapid" },
  { brand: "skoda", model: "scala" },
  { brand: "skoda", model: "kamiq" },
  { brand: "skoda", model: "citigo" },
  // Volkswagen
  { brand: "volkswagen", model: "golf" },
  { brand: "volkswagen", model: "passat" },
  { brand: "volkswagen", model: "tiguan" },
  { brand: "volkswagen", model: "polo" },
  { brand: "volkswagen", model: "t-roc" },
  { brand: "volkswagen", model: "touran" },
  { brand: "volkswagen", model: "caddy" },
  { brand: "volkswagen", model: "sharan" },
  // BMW
  { brand: "bmw", model: "3" },
  { brand: "bmw", model: "5" },
  { brand: "bmw", model: "x3" },
  { brand: "bmw", model: "x5" },
  { brand: "bmw", model: "x1" },
  { brand: "bmw", model: "1" },
  // Audi
  { brand: "audi", model: "a4" },
  { brand: "audi", model: "a6" },
  { brand: "audi", model: "q5" },
  { brand: "audi", model: "a3" },
  { brand: "audi", model: "a5" },
  { brand: "audi", model: "q3" },
  { brand: "audi", model: "a1" },
  { brand: "audi", model: "tt" },
  // Mercedes
  { brand: "mercedes-benz", model: "c" },
  { brand: "mercedes-benz", model: "e" },
  { brand: "mercedes-benz", model: "a" },
  { brand: "mercedes-benz", model: "glc" },
  { brand: "mercedes-benz", model: "b" },
  { brand: "mercedes-benz", model: "gla" },
  // Toyota
  { brand: "toyota", model: "corolla" },
  { brand: "toyota", model: "rav4" },
  { brand: "toyota", model: "yaris" },
  { brand: "toyota", model: "prius" },
  { brand: "toyota", model: "c-hr" },
  // Ford
  { brand: "ford", model: "focus" },
  { brand: "ford", model: "mondeo" },
  { brand: "ford", model: "kuga" },
  { brand: "ford", model: "fiesta" },
  { brand: "ford", model: "puma" },
  { brand: "ford", model: "galaxy" },
  // Hyundai
  { brand: "hyundai", model: "i30" },
  { brand: "hyundai", model: "tucson" },
  { brand: "hyundai", model: "i20" },
  { brand: "hyundai", model: "ioniq" },
  // Kia
  { brand: "kia", model: "ceed" },
  { brand: "kia", model: "sportage" },
  { brand: "kia", model: "rio" },
  { brand: "kia", model: "niro" },
  // Peugeot
  { brand: "peugeot", model: "308" },
  { brand: "peugeot", model: "3008" },
  { brand: "peugeot", model: "208" },
  { brand: "peugeot", model: "2008" },
  { brand: "peugeot", model: "508" },
  // Renault
  { brand: "renault", model: "megane" },
  { brand: "renault", model: "kadjar" },
  { brand: "renault", model: "clio" },
  { brand: "renault", model: "captur" },
  { brand: "renault", model: "scenic" },
  // Seat
  { brand: "seat", model: "leon" },
  { brand: "seat", model: "ateca" },
  { brand: "seat", model: "ibiza" },
  { brand: "seat", model: "arona" },
  { brand: "seat", model: "tarraco" },
  // Opel
  { brand: "opel", model: "astra" },
  { brand: "opel", model: "insignia" },
  { brand: "opel", model: "corsa" },
  { brand: "opel", model: "mokka" },
  { brand: "opel", model: "grandland" },
  // Volvo
  { brand: "volvo", model: "xc60" },
  { brand: "volvo", model: "v60" },
  { brand: "volvo", model: "v90" },
  { brand: "volvo", model: "xc90" },
  { brand: "volvo", model: "s60" },
  // Mazda
  { brand: "mazda", model: "cx-5" },
  { brand: "mazda", model: "3" },
  { brand: "mazda", model: "6" },
  { brand: "mazda", model: "cx-3" },
  // Nissan
  { brand: "nissan", model: "qashqai" },
  { brand: "nissan", model: "x-trail" },
  { brand: "nissan", model: "juke" },
  { brand: "nissan", model: "leaf" },
  // Honda
  { brand: "honda", model: "civic" },
  { brand: "honda", model: "cr-v" },
  { brand: "honda", model: "jazz" },
];

const AUTOBAZAREU_SLUG: Record<string, string> = {
  skoda: "skoda",
  volkswagen: "volkswagen",
  bmw: "bmw",
  audi: "audi",
  "mercedes-benz": "mercedes-benz",
  toyota: "toyota",
  ford: "ford",
  hyundai: "hyundai",
  kia: "kia",
  peugeot: "peugeot",
  renault: "renault",
  seat: "seat",
  opel: "opel",
  volvo: "volvo",
  mazda: "mazda",
  nissan: "nissan",
  honda: "honda",
};

function parseArg(name: string): string | null {
  const i = process.argv.findIndex(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`)
  );
  if (i === -1) return null;
  const arg = process.argv[i]!;
  if (arg.startsWith(`--${name}=`)) return arg.slice(`--${name}=`.length).trim() || null;
  return process.argv[i + 1]?.trim() || null;
}

async function main() {
  const brandFilter = parseArg("brand");
  const pagesArg = parseArg("pages");
  const pages = pagesArg ? Math.min(parseInt(pagesArg, 10) || 50, 200) : 50;
  const sourceFilter = parseArg("source");
  const sautoOnly = process.argv.includes("--sauto-only");

  const targets = brandFilter
    ? DEEP_CRAWL_TARGETS.filter((t) => t.brand === brandFilter)
    : DEEP_CRAWL_TARGETS;

  if (targets.length === 0) {
    console.error(`[deepCrawl] žádné targety pro brand=${brandFilter}`);
    process.exit(1);
  }

  console.log(`[deepCrawl] start: ${targets.length} modelů, ${pages} stránek každý`);
  console.log(`[deepCrawl] source: ${sourceFilter ?? "sauto+tipcars"}`);

  const supabase = getSupabaseAdmin();
  let totalInserted = 0;
  let totalUpdated = 0;

  for (let i = 0; i < targets.length; i++) {
    const { brand, model } = targets[i];
    console.log(`\n[deepCrawl] [${i + 1}/${targets.length}] ${brand} ${model}`);

    if (sautoOnly || !sourceFilter || sourceFilter === "sauto") {
      try {
        const result = await ingestSautoPages({
          pagesRequested: pages,
          brand,
          model,
        });
        totalInserted += result.insertedApprox ?? 0;
        console.log(
          `[deepCrawl] sauto: insertedApprox=${result.insertedApprox} parsedUnique=${result.parsedUnique}`,
        );
      } catch (e) {
        console.error(`[deepCrawl] sauto error ${brand} ${model}:`, e);
      }
    }

    if (!sourceFilter || sourceFilter === "autobazareu") {
      const abBrand = AUTOBAZAREU_SLUG[brand] ?? brand;
      const abModel = model.replace(/\s+/g, "-").toLowerCase();
      try {
        const abResult = await runAutobazarEuIngest({
          brand: abBrand,
          model: abModel,
          pages: 5,
        });
        totalInserted += abResult.inserted;
        console.log(
          `[deepCrawl] autobazareu: inserted=${abResult.inserted} updated=${abResult.updated}`,
        );
      } catch (e) {
        console.error(
          `[deepCrawl] autobazareu error ${brand} ${model}:`,
          e,
        );
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // Pauza mezi modely aby server nepřetížil
    await new Promise((r) => setTimeout(r, 800));
  }

  // Druhý průchod: TipCars globální crawl bez brand filtru pro zachycení zbytku
  if (!sourceFilter || sourceFilter === "tipcars") {
    console.log("\n[deepCrawl] TipCars globální průchod (5 stránek)...");
    try {
      const { runTipcarsIngest: runTipcarsIngestDynamic } = await import(
        "./sources/tipcars"
      );
      const result = await runTipcarsIngestDynamic(supabase, { pages: 5 });
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      console.log(
        `[deepCrawl] tipcars global: inserted=${result.inserted} updated=${result.updated}`,
      );
    } catch (e) {
      console.error("[deepCrawl] tipcars global error:", e);
    }
  }

  const tutut = await crawlTutut(2);
  console.log("tutut:", tutut);

  console.log(`\n[deepCrawl] rebuild price index...`);
  const rebuild = await rebuildPriceIndex(supabase);
  console.log(`[deepCrawl] rebuild done: upserted=${rebuild.upserted}`);

  const sources = ["sauto", "tipcars", "autobazareu", "tutut"];
  for (const source of sources) {
    const { deactivated } = await deactivateStaleObservations(supabase, source);
    console.log(`[deactivate] ${source}: ${deactivated} stale observations marked inactive`);
  }

  console.log(`\n[deepCrawl] HOTOVO`);
  console.log(`[deepCrawl] total inserted=${totalInserted} updated=${totalUpdated}`);
}

main().catch((e) => {
  console.error("[deepCrawl] fatal:", e);
  process.exit(1);
});

