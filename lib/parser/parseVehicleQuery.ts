import {
  bucketForMileage,
  bucketForYear,
  composeBucket,
} from "@/lib/pricing/buckets";
import { normalizeModelKey } from "@/lib/cars/normalizeModel";

export type EngineKey =
  // diesel
  | "1_6_tdi"
  | "1_9_tdi"
  | "2_0_tdi"
  | "2_0_tdi_4x4"
  // petrol
  | "1_0_tsi"
  | "1_2_tsi"
  | "1_4_tsi"
  | "1_5_tsi"
  | "1_8_tsi"
  | "2_0_tsi"
  // special / flags
  | "rs"
  | "dsg"
  | "lpg"
  | "hybrid"
  | "ev"
  | "unknown";

export type ParsedVehicleQuery = {
  brand?: string;
  model?: string;
  model_key?: string;
  year?: number;
  mileage_km?: number;
  fuel?: string;
  transmission?: string;
  engine?: string;
  engine_key?: EngineKey | null;
  bucket?: string;
};

const BRAND_MAP: Record<string, string[]> = {
  skoda: ["skoda"],
  volkswagen: ["vw", "volkswagen"],
  bmw: ["bmw"],
  audi: ["audi"],
  mercedes_benz: ["mercedes", "mb", "mercedes-benz"],
  toyota: ["toyota"],
  ford: ["ford"],
};

const MODEL_MAP: Record<string, string[]> = {
  skoda_octavia: ["octavia"],
  skoda_superb: ["superb"],
  vw_passat: ["passat"],
  vw_golf: ["golf"],
  bmw_3_series: ["320", "330", "3er"],
  audi_a4: ["a4"],
  audi_a6: ["a6"],
};

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[,]/g, " ")
    .trim();
}

/** Detect engine / drivetrain variant from normalized query; returns normalized engine_key or null. */
function parseEngineKey(norm: string): EngineKey | null {
  const has4x4 = /\b4x4\b/.test(norm);

  // Diesel TDI patterns – allow dots, commas, spaces, missing spaces:
  // 2.0tdi, 2,0 tdi, 20tdi, 2 0 tdi, etc.
  const is2_0_tdi = /\b(?:2[.,\s]*0|20)[.,\s]*tdi\b/.test(norm);
  const is1_9_tdi = /\b(?:1[.,\s]*9|19)[.,\s]*tdi\b/.test(norm);
  const is1_6_tdi = /\b(?:1[.,\s]*6|16)[.,\s]*tdi\b/.test(norm);

  if (is2_0_tdi && has4x4) return "2_0_tdi_4x4";
  if (is2_0_tdi) return "2_0_tdi";
  if (is1_9_tdi) return "1_9_tdi";
  if (is1_6_tdi) return "1_6_tdi";

  // Petrol TSI patterns
  if (/\b(?:1[.,\s]*0|10)[.,\s]*tsi\b/.test(norm)) return "1_0_tsi";
  if (/\b(?:1[.,\s]*2|12)[.,\s]*tsi\b/.test(norm)) return "1_2_tsi";
  if (/\b(?:1[.,\s]*4|14)[.,\s]*tsi\b/.test(norm)) return "1_4_tsi";
  if (/\b(?:1[.,\s]*5|15)[.,\s]*tsi\b/.test(norm)) return "1_5_tsi";
  if (/\b(?:1[.,\s]*8|18)[.,\s]*tsi\b/.test(norm)) return "1_8_tsi";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*tsi\b/.test(norm)) return "2_0_tsi";

  // Special flags
  if (/\brs\b/.test(norm)) return "rs";
  if (/\bdsg\b/.test(norm)) return "dsg";

  // Fuel / drivetrain-only hints
  if (/\blpg\b/.test(norm)) return "lpg";
  if (/\b(?:hybrid|phev|hev)\b/.test(norm)) return "hybrid";
  if (/\b(?:ev|electric|elektro)\b/.test(norm)) return "ev";

  return null;
}

export function parseVehicleQuery(input: string): ParsedVehicleQuery {
  const result: ParsedVehicleQuery = {};

  try {
    const raw = (input ?? "").trim();
    const norm = normalize(raw);

    if (!norm) return result;

    const tokens = raw.split(/\s+/).filter(Boolean);
    const normTokens = tokens.map((t) => normalizeToken(t));

    // Year: standalone 4-digit year.
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      if (Number.isFinite(year) && year >= 1980 && year <= 2035) {
        result.year = year;
      }
    }

    // Engine: normalized engine_key surfaced as engine.
    const engineKey = parseEngineKey(norm);
    if (engineKey) {
      result.engine_key = engineKey;
      result.engine = engineKey;
    }

    // Brand + model from first tokens when possible.
    if (normTokens.length >= 1) {
      const first = normTokens[0];

      for (const [brandKey, aliases] of Object.entries(BRAND_MAP)) {
        if (aliases.includes(first)) {
          result.brand = brandKey;
          break;
        }
      }

      if (result.brand && normTokens.length >= 2) {
        // brand + model (e.g. "ford mondeo 2015")
        result.model = normTokens[1];
      } else if (!result.brand && normTokens.length >= 2) {
        // partial: treat first token as model when brand is unknown (e.g. "golf 2018")
        result.model = normTokens[0];
      }
    }

    // Model / model_key using shared normalization when we have brand + model.
    if (result.brand && result.model) {
      const normalizedKey = normalizeModelKey({
        brand: result.brand,
        model: result.model,
        trim: null,
      });
      if (normalizedKey) {
        result.model_key = normalizedKey;
      }
    }

    // Fallback: legacy MODEL_MAP-based detection if still no model_key.
    if (!result.model_key) {
      for (const [modelKey, aliases] of Object.entries(MODEL_MAP)) {
        if (aliases.some((a) => norm.includes(a))) {
          result.model_key = modelKey;
          if (!result.model) {
            if (modelKey === "bmw_3_series") {
              result.model = "3 series";
            } else {
              const parts = modelKey.split("_");
              result.model = parts.slice(1).join(" ");
            }
          }
          break;
        }
      }
    }

    // Infer brand/model from model_key if missing.
    if (result.model_key) {
      const [brandPart, ...modelParts] = result.model_key.split("_");
      if (!result.brand && brandPart) {
        result.brand = brandPart === "vw" ? "volkswagen" : brandPart;
      }
      if (!result.model && modelParts.length) {
        result.model = modelParts.join(" ");
      }
    }

    // Mileage (heuristic; optional).
    let mileage: number | undefined;
    const kMatch = norm.match(/(\d{2,3})\s*k\b/); // e.g. 150k
    if (kMatch) {
      const base = parseInt(kMatch[1], 10);
      if (!Number.isNaN(base)) {
        mileage = base * 1000;
      }
    }
    if (mileage === undefined) {
      const groupedKmMatch = norm.match(/(\d{1,3}(?:\s\d{3}){1,2})\s*km\b/); // e.g. 150 000 km
      if (groupedKmMatch) {
        const base = parseInt(groupedKmMatch[1].replace(/\s/g, ""), 10);
        if (!Number.isNaN(base) && base >= 1000) {
          mileage = base;
        }
      }
    }
    if (mileage === undefined) {
      const kmMatch = norm.match(/(\d{2,3})\s*(?:k?m)\b/); // 150km, 150 km
      if (kmMatch) {
        const base = parseInt(kmMatch[1], 10);
        if (!Number.isNaN(base)) {
          mileage = base >= 1000 ? base : base * 1000;
        }
      }
    }
    if (mileage === undefined) {
      const plainMatch = norm.match(/(\d{5,6})/); // e.g. 120000 (bez "km")
      if (plainMatch) {
        const base = parseInt(plainMatch[1], 10);
        if (!Number.isNaN(base) && base >= 5000 && base <= 600_000) {
          mileage = base;
        }
      }
    }
    if (mileage !== undefined) {
      result.mileage_km = mileage;
    }

    // Fuel
    const fuelAliases: { key: string; tokens: string[] }[] = [
      { key: "Diesel", tokens: ["tdi", "dci", "hdi", "diesel", "d-4d"] },
      {
        key: "Benzín",
        tokens: ["tsi", "tfsi", "fsi", "benzin", "benzín", "petrol"],
      },
      { key: "Hybrid", tokens: ["hybrid"] },
      { key: "Elektro", tokens: ["ev", "electric", "bev"] },
    ];
    for (const f of fuelAliases) {
      if (f.tokens.some((t) => norm.includes(t))) {
        result.fuel = f.key;
        break;
      }
    }

    // Transmission
    const transAliases: { key: string; tokens: string[] }[] = [
      {
        key: "Automat",
        tokens: ["dsg", "automat", "automatic", "tiptronic", "cvt"],
      },
      { key: "Manuál", tokens: ["manual", "manu", "man "] },
    ];
    for (const t of transAliases) {
      if (t.tokens.some((tok) => norm.includes(tok))) {
        result.transmission = t.key;
        break;
      }
    }

    // Bucket for price index (optional; depends on year + mileage).
    if (result.year && result.mileage_km !== undefined) {
      const yearBucket = bucketForYear(result.year);
      if (yearBucket === "unknown_year") {
        result.bucket = "all";
      } else {
        const mileageBucket = bucketForMileage(result.mileage_km);
        result.bucket = composeBucket({ yearBucket, mileageBucket });
      }
    }

    return result;
  } catch {
    // Never throw – best-effort partial result.
    return result;
  }
}

/*
  Unit-like examples (input -> parsed.engine_key):

  parseVehicleQuery("Škoda Octavia 2015 2.0 TDI 200000")
    -> engine_key: "2_0_tdi"

  parseVehicleQuery("Kodiaq 2.0 TDI 4x4 2019")
    -> engine_key: "2_0_tdi_4x4"

  parseVehicleQuery("Superb 2018 1.6 tdi DSG")
    -> engine_key: "1_6_tdi"  (DSG present but engine displacement wins)

  parseVehicleQuery("Octavia RS 2.0 tsi 2019")
    -> engine_key: "2_0_tsi"

  parseVehicleQuery("Fabia 1.0 tsi 2020")
    -> engine_key: "1_0_tsi"

  parseVehicleQuery("Octavia 1,4 TSI LPG 2014")
    -> engine_key: "1_4_tsi"

  parseVehicleQuery("Golf 1.8 tsi 2016")
    -> engine_key: "1_8_tsi"

  parseVehicleQuery("VW Passat 20tsi")
    -> engine_key: "2_0_tsi"

  parseVehicleQuery("BMW 1.9 tdi 200k")
    -> engine_key: "1_9_tdi"

  parseVehicleQuery("Octavia LPG")
    -> engine_key: "lpg"

  parseVehicleQuery("Toyota Corolla hybrid")
    -> engine_key: "hybrid"

  parseVehicleQuery("Tesla Model 3 EV")
    -> engine_key: "ev"

  parseVehicleQuery("Octavia diesel 2018")
    -> engine_key: "unknown" (fuel detected, no exact engine displacement)

  parseVehicleQuery("Octavia 2019 80000")
    -> engine_key: null (no engine-related tokens)
*/
