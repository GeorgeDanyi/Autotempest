import { MODEL_ALIASES } from "@/lib/cars/modelAliases";
import { buildModelKey } from "@/lib/ingest/textNormalize";

function normalizeAscii(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalBrandKey(rawBrand: string | null | undefined): string | null {
  if (!rawBrand) return null;
  const b = normalizeAscii(rawBrand);
  if (!b) return null;
  if (MODEL_ALIASES[b]) return b;
  if (b === "vw") return "volkswagen";
  if (b === "mercedes-benz" || b === "mercedes benz" || b === "mercedes") {
    return "mercedes_benz";
  }
  if (b === "land rover" || b === "land-rover" || b === "landrover") {
    return "land_rover";
  }
  if (b === "mb") return "mercedes_benz";
  return MODEL_ALIASES[b] ? b : null;
}

function findCanonicalModel(
  brandAliases: Record<string, string[]>,
  textNorm: string,
): string | null {
  if (!textNorm) return null;

  // Pass 1: exact alias match
  for (const [key, aliases] of Object.entries(brandAliases)) {
    for (const alias of aliases) {
      const aliasNorm = normalizeAscii(alias);
      if (aliasNorm && textNorm === aliasNorm) {
        return key;
      }
    }
  }

  // Pass 2: token / substring match
  for (const [key, aliases] of Object.entries(brandAliases)) {
    for (const alias of aliases) {
      const aliasNorm = normalizeAscii(alias);
      if (!aliasNorm) continue;
      if (aliasNorm.includes(" ")) {
        // multi-word alias: allow substring match
        if (textNorm.includes(aliasNorm)) {
          return key;
        }
      } else {
        // single token alias: require token-level match to avoid e.g. "i3" → "3_series"
        const tokens = textNorm.split(" ").filter(Boolean);
        if (tokens.includes(aliasNorm)) {
          return key;
        }
      }
    }
  }

  return null;
}

function isGenericSeriesOrClass(modelNorm: string): boolean {
  if (!modelNorm) return false;
  return (
    modelNorm === "rada" ||
    modelNorm === "rada." ||
    modelNorm === "rada  " ||
    modelNorm === "trida" ||
    modelNorm === "trida." ||
    modelNorm === "tridy" ||
    modelNorm === "tridy." ||
    modelNorm === "tridy  "
  );
}

export function isBrandOnlyOrGenericModelKey(
  modelKey: string | null | undefined,
): boolean {
  if (!modelKey) return false;
  const key = String(modelKey).toLowerCase();

  if (key === "bmw" || key === "mercedes_benz" || key === "land_rover") {
    return true;
  }

  // Treat generic "series/class"-style keys as too vague.
  if (/_rada$|_trida$|_tridy$/.test(key)) {
    return true;
  }

  return false;
}

export function normalizeModelKey(params: {
  brand: string | null | undefined;
  model: string | null | undefined;
  trim?: string | null | undefined;
}): string | null {
  const { brand, model, trim } = params;
  if (!brand) return null;

  const brandKey = canonicalBrandKey(brand);
  const modelNorm = normalizeAscii(model);
  const trimNorm = normalizeAscii(trim);

  if (!brandKey) {
    return model ? buildModelKey(brand, model) : null;
  }

  const brandAliases = MODEL_ALIASES[brandKey];
  if (!brandAliases) {
    return model ? buildModelKey(brand, model) : null;
  }

  // Prefer model + trim combined, but allow trim-only rescue when model is too generic.
  const combined = [model, trim].filter(Boolean).join(" ");
  const combinedNorm = normalizeAscii(combined);
  const bodylessCombinedNorm = combinedNorm
    .replace(/\b(combi|touring|avant|variant|sportback)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  let canonicalModel: string | null = null;

  if (combinedNorm) {
    canonicalModel =
      findCanonicalModel(brandAliases, combinedNorm) ||
      findCanonicalModel(brandAliases, bodylessCombinedNorm);
  }

  // If still no match and the model text is too generic (řada/trida/tridy),
  // try using only trim/title tokens before giving up.
  if (!canonicalModel && isGenericSeriesOrClass(modelNorm) && trimNorm) {
    const bodylessTrimNorm = trimNorm
      .replace(/\b(combi|touring|avant|variant|sportback)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    canonicalModel =
      findCanonicalModel(brandAliases, trimNorm) ||
      findCanonicalModel(brandAliases, bodylessTrimNorm);
  }

  if (canonicalModel) {
    return `${brandKey}_${canonicalModel}`;
  }

  // Fallback: build a generic slug-based key, but avoid leaking *_rada / *_trida / *_tridy
  if (model) {
    const fallback = buildModelKey(brand, model);
    const needsRescueGeneric =
      /_rada$|_trida$|_tridy$/.test(fallback) ||
      fallback === "land_rover" ||
      /mercedes_benz_trida$/.test(fallback) ||
      /mercedes_benz_tridy$/.test(fallback);
    if (needsRescueGeneric && trimNorm) {
      const rescued = findCanonicalModel(brandAliases, trimNorm);
      if (rescued) {
        return `${brandKey}_${rescued}`;
      }
    }
    // Never downgrade to brand-only or otherwise generic keys.
    if (isBrandOnlyOrGenericModelKey(fallback)) {
      return null;
    }
    return fallback;
  }

  return null;
}

/*
  Examples:

  normalizeModelKey({ brand: "Škoda", model: "Octavia Combi" })
    -> "skoda_octavia"

  normalizeModelKey({ brand: "BMW", model: "Řada 3", trim: "320d Touring" })
    -> "bmw_3_series"

  normalizeModelKey({ brand: "Audi", model: "A4 Avant" })
    -> "audi_a4"

  normalizeModelKey({ brand: "Mercedes-Benz", model: "Třídy C", trim: "C220" })
    -> "mercedes_benz_c_class"

  normalizeModelKey({ brand: "Land Rover", model: "Range Rover Sport" })
    -> "land_rover_range_rover"

  normalizeModelKey({ brand: "Dodge", model: "RAM 1500" })
    -> "dodge_ram"

  normalizeModelKey({ brand: "BMW", model: "Řada 3", trim: "320d Touring" })
    -> "bmw_3_series"

  normalizeModelKey({ brand: "BMW", model: "i3" })
    -> "bmw_i3"
*/

