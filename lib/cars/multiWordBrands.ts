/**
 * Víceslovné značky – rozpoznání při parsování title/URL, aby nedošlo k chybnému splitu:
 * např. "Land Rover Discovery" → brand "Land Rover", model "Discovery" (ne brand "Land", model "Rover").
 */

import { normalizeBrandKey, formatBrandLabelFromKey } from "@/lib/analyze/normalizeBrandKey";

/**
 * Značky, které tvoří více slov. Key = normalizovaný tvar (land_rover), display = pro DB/UI.
 * Seřazeno délkou display sestupně, aby se matchoval nejdelší prefix (Land Rover před Land).
 */
const MULTI_WORD_BRAND_KEYS = [
  "land_rover",
  "mercedes_benz",
  "alfa_romeo",
] as const;

function toDisplay(key: string): string {
  const map: Record<string, string> = {
    land_rover: "Land Rover",
    mercedes_benz: "Mercedes-Benz",
    alfa_romeo: "Alfa Romeo",
  };
  return map[key] ?? formatBrandLabelFromKey(key);
}

/**
 * Pro title (např. "Land Rover Discovery" nebo "Mercedes-Benz Třída C") vrátí { brandDisplay, model }
 * pokud začátek titulku odpovídá víceslovné značce. Jinak null (parsování použije fallback).
 */
export function splitTitleIntoBrandAndModel(
  title: string | null | undefined
): { brandDisplay: string; model: string } | null {
  if (!title || typeof title !== "string") return null;
  const t = title.trim();
  if (!t) return null;

  const lower = t.toLowerCase();
  for (const key of MULTI_WORD_BRAND_KEYS) {
    const display = toDisplay(key);
    const prefix = display.toLowerCase();
    if (lower === prefix) {
      return { brandDisplay: display, model: "" };
    }
    if (lower.startsWith(prefix + " ") && t.length > prefix.length + 1) {
      const model = t.slice(prefix.length + 1).trim();
      return { brandDisplay: display, model };
    }
  }
  return null;
}

/**
 * Pro URL path segmenty (např. ["land", "rover", "discovery"]) vrátí { brandDisplay, model }
 * pokud prefix segmentů tvoří víceslovnou značku. Jinak null.
 */
export function splitUrlPathIntoBrandAndModel(
  segments: string[]
): { brandDisplay: string; model: string } | null {
  if (!segments.length) return null;

  for (let n = Math.min(segments.length, 3); n >= 1; n--) {
    const prefixSegments = segments.slice(0, n);
    const slug = prefixSegments.join("_").toLowerCase().replace(/-/g, "_");
    const key = slug.replace(/-/g, "_");
    if ((MULTI_WORD_BRAND_KEYS as readonly string[]).includes(key)) {
      const brandDisplay = toDisplay(key);
      const rest = segments.slice(n);
      const model = rest
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(" ");
      return { brandDisplay, model };
    }
  }
  return null;
}

/**
 * Vrátí true, pokud je model pravděpodobně jen druhá část názvu značky (invalid parse).
 * Např. brand "Land Rover", model "Rover" → true; brand "Land", model "Rover" → true.
 */
export function isModelLikelyBrandSuffix(
  brandDisplay: string | null | undefined,
  model: string | null | undefined
): boolean {
  if (!model || !brandDisplay) return false;
  const m = model.trim().toLowerCase();
  const b = brandDisplay.trim();
  const words = b.split(/\s+/).map((w) => w.replace(/-/g, " ").toLowerCase());
  if (words.length < 2) return false;
  const lastWord = words[words.length - 1];
  return m === lastWord || m === lastWord.replace(/-/g, "");
}
