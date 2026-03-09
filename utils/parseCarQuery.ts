export type CarQueryDictionaries = {
  brands: string[]; // canonical brand names, e.g. "Škoda", "Volkswagen"
  modelsByBrand: Record<string, string[]>;
  fuelOptions: string[]; // e.g. ["Benzín","Diesel",...]
  gearboxOptions: string[]; // e.g. ["Manuální","Automatická","DSG","CVT"]
  engineOptions?: string[];
  powerBuckets?: string[]; // e.g. ["Libovolně","0–80 kW",...]
  bodyTypes?: string[];
  drivetrains?: string[];
};

export type ParsedCarQuery = {
  brand?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  mileageFrom?: number;
  mileageTo?: number;
  fuel?: string;
  gearbox?: string;
  engine?: string;
  powerKw?: number;
  powerBucket?: string;
  bodyType?: string;
  drivetrain?: string;
};

export type ParsedCarQueryResult = {
  parsed: ParsedCarQuery;
  confidence: number;
  tokens: string[];
};

type KeywordMap = Record<string, string>;

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildBrandKeywordMap(brands: string[]): KeywordMap {
  const map: KeywordMap = {};
  for (const b of brands) {
    const n = normalize(b);
    map[n] = b;
  }
  // Common aliases
  map["skoda"] = brands.find((b) => normalize(b) === "skoda") ?? "Škoda";
  map["vw"] = brands.find((b) => normalize(b).includes("volkswagen")) ?? "Volkswagen";
  map["volkswagen"] = brands.find((b) => normalize(b).includes("volkswagen")) ?? "Volkswagen";
  map["mercedes"] =
    brands.find((b) => normalize(b).startsWith("mercedes")) ?? "Mercedes-Benz";
  return map;
}

const FUEL_KEYWORDS: Record<"diesel" | "petrol" | "hybrid" | "phev" | "ev" | "lpgcng", string[]> =
  {
    diesel: ["tdi", "d", "diesel", "tddi", "cdti", "dci", "hdi", "tdci"],
    petrol: ["tsi", "tfsi", "ts", "benzín", "benzin", "petrol", "gdi", "mpi", "tce", "ecoboost"],
    hybrid: ["hybrid", "hev"],
    phev: ["plug-in", "phev"],
    ev: ["ev", "elektro", "electric", "bev"],
    lpgcng: ["lpg", "cng"],
  };

const GEARBOX_KEYWORDS = {
  auto: ["dsg", "automat", "automatic", "at", "tiptronic", "cvt"],
  manual: ["manuál", "manual", "mt"],
};

const DRIVETRAIN_KEYWORDS = {
  awd: ["4x4", "awd", "4motion", "xdrive", "quattro", "4matic"],
  fwd: ["fwd", "přední", "predni"],
  rwd: ["rwd", "zadní", "zadni"],
};

const BODY_TYPE_KEYWORDS = {
  kombi: ["kombi", "combi", "variant", "wagon", "touring"],
  sedan: ["sedan", "limuzína", "limuzina"],
  hatch: ["hatch", "hatchback"],
  suv: ["suv", "crossover"],
  coupe: ["coupe", "kupé", "kupe"],
  cabrio: ["cabrio", "kabriolet"],
};

function detectBrand(textNorm: string, dict: CarQueryDictionaries): string | undefined {
  const brandMap = buildBrandKeywordMap(dict.brands);
  let best: string | undefined;
  let bestIndex = Infinity;
  for (const key of Object.keys(brandMap)) {
    const idx = textNorm.indexOf(key);
    if (idx !== -1 && idx < bestIndex) {
      bestIndex = idx;
      best = brandMap[key];
    }
  }
  return best;
}

function detectModel(
  textNorm: string,
  brand: string | undefined,
  dict: CarQueryDictionaries,
): string | undefined {
  const searchIn = brand ? dict.modelsByBrand[brand] ?? [] : Object.values(dict.modelsByBrand).flat();
  let best: string | undefined;
  let bestLen = 0;
  for (const m of searchIn) {
    const n = normalize(m);
    if (n.length <= bestLen) continue;
    if (textNorm.includes(n)) {
      best = m;
      bestLen = n.length;
    }
  }
  return best;
}

function detectYears(text: string): { yearFrom?: number; yearTo?: number } {
  const res: { yearFrom?: number; yearTo?: number } = {};
  const currentYear = new Date().getFullYear() + 1;
  const matches = Array.from(text.matchAll(/\b(19|20)\d{2}\b/g)).map((m) => parseInt(m[0], 10));
  const inRange = matches.filter((y) => y >= 1990 && y <= currentYear);
  if (inRange.length === 0) return res;

  const lower = text.toLowerCase();
  for (const y of inRange) {
    const ys = String(y);
    if (lower.includes(`od ${ys}`)) {
      res.yearFrom = y;
    } else if (lower.includes(`do ${ys}`)) {
      res.yearTo = y;
    }
  }

  if (inRange.length === 1 && !res.yearFrom && !res.yearTo) {
    res.yearFrom = inRange[0];
    res.yearTo = inRange[0];
  } else {
    if (!res.yearFrom) res.yearFrom = Math.min(...inRange);
    if (!res.yearTo) res.yearTo = Math.max(...inRange);
  }
  return res;
}

function parseMileageNumber(raw: string, hasK: boolean): number {
  let num = parseInt(raw.replace(/\s/g, ""), 10);
  if (Number.isNaN(num)) return NaN;
  if (hasK || num < 1000) num *= 1000;
  return num;
}

function detectMileage(text: string): { mileageFrom?: number; mileageTo?: number } {
  const res: { mileageFrom?: number; mileageTo?: number } = {};
  const lower = text.toLowerCase();

  const rangeRe = /(od|do)\s+(\d{1,3}(?:\s?\d{3})?)(?:\s*(k|km))?/g;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(lower))) {
    const dir = m[1];
    const raw = m[2];
    const hasK = !!m[3] && m[3].startsWith("k");
    const val = parseMileageNumber(raw, hasK);
    if (Number.isNaN(val)) continue;
    if (dir === "od") res.mileageFrom = val;
    else res.mileageTo = val;
  }

  if (!res.mileageFrom && !res.mileageTo) {
    const single = /(\d{1,3}(?:\s?\d{3})?)\s*(k|km)?/.exec(lower);
    if (single) {
      const raw = single[1];
      const hasK = !!single[2] && single[2].startsWith("k");
      const val = parseMileageNumber(raw, hasK);
      if (!Number.isNaN(val)) res.mileageTo = val;
    }
  }
  return res;
}

function detectEngine(text: string): string | undefined {
  const m = /(\d\.\d)\s*(tdi|tsi|tfsi|hdi|dci|cdti|tdci|mpi|gdi|tce|ecoboost)?/i.exec(text);
  if (!m) return;
  const liters = m[1];
  const suffix = m[2];
  if (suffix) return `${liters} ${suffix.toUpperCase()}`;
  return liters;
}

function detectPower(text: string, buckets?: string[]): { kw?: number; bucket?: string } {
  const m = /(\d{2,3})\s*kW/i.exec(text);
  if (!m) return {};
  const kw = parseInt(m[1], 10);
  if (Number.isNaN(kw)) return {};
  let bucket: string | undefined;
  if (buckets && buckets.length > 0) {
    for (const b of buckets) {
      if (b.toLowerCase() === "libovolně") continue;
      const rangeMatch = /(\d+)[^\d]+(\d+)/.exec(b);
      if (rangeMatch) {
        const from = parseInt(rangeMatch[1], 10);
        const to = parseInt(rangeMatch[2], 10);
        if (kw >= from && kw <= to) {
          bucket = b;
          break;
        }
      } else if (b.includes("+")) {
        const numMatch = /(\d+)/.exec(b);
        if (numMatch) {
          const min = parseInt(numMatch[1], 10);
          if (kw >= min) {
            bucket = b;
            break;
          }
        }
      }
    }
  }
  return { kw, bucket };
}

function detectFuel(textNorm: string, engine: string | undefined, fuelOptions: string[]): string | undefined {
  let fuelType: "diesel" | "petrol" | "hybrid" | "phev" | "ev" | "lpgcng" | undefined;

  if (engine) {
    const en = normalize(engine);
    if (en.includes("tdi") || en.includes("hdi") || en.includes("dci") || en.includes("cdti")) {
      fuelType = "diesel";
    } else if (en.includes("tsi") || en.includes("tfsi") || en.includes("mpi") || en.includes("gdi")) {
      fuelType = "petrol";
    }
  }

  if (!fuelType) {
    for (const [type, kws] of Object.entries(FUEL_KEYWORDS)) {
      if (kws.some((k) => textNorm.includes(normalize(k)))) {
        fuelType = type as keyof typeof FUEL_KEYWORDS;
        break;
      }
    }
  }

  if (!fuelType) return;

  const mapOrder: { kind: typeof fuelType; labels: string[] }[] = [
    { kind: "diesel", labels: ["diesel", "nafta"] },
    { kind: "petrol", labels: ["benzín", "benzin"] },
    { kind: "hybrid", labels: ["hybrid"] },
    { kind: "phev", labels: ["plug-in hybrid"] },
    { kind: "ev", labels: ["elektro"] },
    { kind: "lpgcng", labels: ["LPG/CNG"] },
  ];

  const wanted = mapOrder.find((m) => m.kind === fuelType);
  if (!wanted) return;

  for (const label of wanted.labels) {
    const match = fuelOptions.find((opt) => normalize(opt) === normalize(label));
    if (match) return match;
  }

  return fuelOptions[0];
}

function detectGearbox(textNorm: string, gearboxOptions: string[]): string | undefined {
  let type: "auto" | "manual" | undefined;
  if (GEARBOX_KEYWORDS.auto.some((k) => textNorm.includes(normalize(k)))) {
    type = "auto";
  } else if (GEARBOX_KEYWORDS.manual.some((k) => textNorm.includes(normalize(k)))) {
    type = "manual";
  }
  if (!type) return;

  if (type === "auto") {
    if (textNorm.includes("dsg")) {
      const dsg = gearboxOptions.find((g) => normalize(g) === "dsg");
      if (dsg) return dsg;
    }
    return gearboxOptions.find((g) => normalize(g).startsWith("automat")) ?? gearboxOptions[0];
  }
  return gearboxOptions.find((g) => normalize(g).startsWith("manu")) ?? gearboxOptions[0];
}

function detectDrivetrain(
  textNorm: string,
  drivetrains: string[] | undefined,
): string | undefined {
  if (!drivetrains) return;
  let type: "awd" | "fwd" | "rwd" | undefined;
  if (DRIVETRAIN_KEYWORDS.awd.some((k) => textNorm.includes(normalize(k)))) {
    type = "awd";
  } else if (DRIVETRAIN_KEYWORDS.fwd.some((k) => textNorm.includes(normalize(k)))) {
    type = "fwd";
  } else if (DRIVETRAIN_KEYWORDS.rwd.some((k) => textNorm.includes(normalize(k)))) {
    type = "rwd";
  }
  if (!type) return;

  if (type === "awd") {
    return drivetrains.find((d) => normalize(d).includes("4x4") || normalize(d).includes("awd")) ?? drivetrains[0];
  }
  if (type === "fwd") {
    return drivetrains.find((d) => normalize(d).includes("predni") || normalize(d).includes("fwd")) ?? drivetrains[0];
  }
  return drivetrains.find((d) => normalize(d).includes("zadni") || normalize(d).includes("rwd")) ?? drivetrains[0];
}

function detectBodyType(textNorm: string, bodyTypes: string[] | undefined): string | undefined {
  if (!bodyTypes) return;
  for (const [kind, kws] of Object.entries(BODY_TYPE_KEYWORDS)) {
    if (kws.some((k) => textNorm.includes(normalize(k)))) {
      // map to canonical body type label if present
      const match = bodyTypes.find((b) => normalize(b).includes(normalize(kind)));
      return match ?? bodyTypes[0];
    }
  }
  return;
}

export function parseCarQuery(
  query: string,
  dict: CarQueryDictionaries,
): ParsedCarQueryResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { parsed: {}, confidence: 0, tokens: [] };
  }

  const textNorm = normalize(trimmed);
  const parsed: ParsedCarQuery = {};
  const tokens: string[] = [];
  let confidence = 0;

  // Brand
  const brand = detectBrand(textNorm, dict);
  if (brand) {
    parsed.brand = brand;
    tokens.push(brand);
    confidence += 0.35;
  }

  // Model
  const model = detectModel(textNorm, brand, dict);
  if (model) {
    parsed.model = model;
    tokens.push(model);
    confidence += 0.35;
  }

  // Years
  const years = detectYears(trimmed);
  if (years.yearFrom) {
    parsed.yearFrom = years.yearFrom;
    tokens.push(String(years.yearFrom));
    confidence += 0.1;
  }
  if (years.yearTo && years.yearTo !== years.yearFrom) {
    parsed.yearTo = years.yearTo;
  }

  // Mileage
  const mileage = detectMileage(trimmed);
  if (mileage.mileageFrom) {
    parsed.mileageFrom = mileage.mileageFrom;
    tokens.push(`${mileage.mileageFrom.toLocaleString("cs-CZ")} km`);
    confidence += 0.05;
  }
  if (mileage.mileageTo && mileage.mileageTo !== mileage.mileageFrom) {
    parsed.mileageTo = mileage.mileageTo;
  }

  // Engine
  const engine = detectEngine(trimmed);
  if (engine) {
    parsed.engine = engine;
    tokens.push(engine);
    confidence += 0.1;
  }

  // Power
  const power = detectPower(trimmed, dict.powerBuckets);
  if (power.kw) {
    parsed.powerKw = power.kw;
    if (power.bucket) parsed.powerBucket = power.bucket;
    tokens.push(`${power.kw} kW`);
    confidence += 0.05;
  }

  // Fuel
  const fuel = detectFuel(textNorm, parsed.engine, dict.fuelOptions);
  if (fuel) {
    parsed.fuel = fuel;
    tokens.push(fuel);
    confidence += 0.05;
  }

  // Gearbox
  const gearbox = detectGearbox(textNorm, dict.gearboxOptions);
  if (gearbox) {
    parsed.gearbox = gearbox;
    tokens.push(gearbox);
    confidence += 0.05;
  }

  // Drivetrain
  const drivetrain = detectDrivetrain(textNorm, dict.drivetrains);
  if (drivetrain) {
    parsed.drivetrain = drivetrain;
    tokens.push(drivetrain);
    confidence += 0.05;
  }

  // Body type
  const bodyType = detectBodyType(textNorm, dict.bodyTypes);
  if (bodyType) {
    parsed.bodyType = bodyType;
    tokens.push(bodyType);
    confidence += 0.05;
  }

  // Clamp confidence
  confidence = Math.max(0, Math.min(1, confidence));

  return { parsed, confidence, tokens };
}

