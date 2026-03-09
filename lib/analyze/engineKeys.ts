/**
 * Mapování motoru mezi UI labelem a stabilním engine_key pro URL a API.
 * V URL a API vždy engine_key (např. 2_0_tdi), v UI label (např. 2.0 TDI).
 */

const LABEL_TO_KEY: Record<string, string> = {
  "1.6 TDI": "1_6_tdi",
  "1.9 TDI": "1_9_tdi",
  "2.0 TDI": "2_0_tdi",
  "2.0 TDI 4x4": "2_0_tdi_4x4",
  "1.0 TSI": "1_0_tsi",
  "1.2 TSI": "1_2_tsi",
  "1.4 TSI": "1_4_tsi",
  "1.5 TSI": "1_5_tsi",
  "1.8 TSI": "1_8_tsi",
  "2.0 TSI": "2_0_tsi",
  RS: "rs",
  DSG: "dsg",
  Hybrid: "hybrid",
  EV: "ev",
};

const KEY_TO_LABEL: Record<string, string> = {
  "1_6_tdi": "1.6 TDI",
  "1_9_tdi": "1.9 TDI",
  "2_0_tdi": "2.0 TDI",
  "2_0_tdi_4x4": "2.0 TDI 4x4",
  "1_0_tsi": "1.0 TSI",
  "1_2_tsi": "1.2 TSI",
  "1_4_tsi": "1.4 TSI",
  "1_5_tsi": "1.5 TSI",
  "1_8_tsi": "1.8 TSI",
  "2_0_tsi": "2.0 TSI",
  rs: "RS",
  dsg: "DSG",
  hybrid: "Hybrid",
  ev: "EV",
};

/** Label (např. "2.0 TDI") → engine_key (např. "2_0_tdi"). Pro Select/ComboBox hodnotu. */
export function toEngineKey(label: string | null): string | null {
  if (!label || label.trim() === "" || label === "Libovolně") return null;
  const t = label.trim();
  return LABEL_TO_KEY[t] ?? null;
}

/** engine_key (např. "2_0_tdi") → label (např. "2.0 TDI") pro zobrazení. */
export function fromEngineKey(key: string | null): string | null {
  if (!key || key.trim() === "") return null;
  const k = key.trim().toLowerCase();
  return KEY_TO_LABEL[k] ?? key.replace(/_/g, " ").toUpperCase();
}

/**
 * Normalizuje hodnotu z URL na engine_key.
 * - Pokud už je engine_key (obsahuje "_"), vrátí ji.
 * - Pokud je to label (např. "2.0 TDI"), převede na engine_key.
 * - Chrání před použitím raw labelu v API a před chybami pattern.
 */
export function normalizeEngineParam(param: string | null): string | null {
  if (param == null || String(param).trim() === "") return null;
  const s = String(param).trim();
  if (s.includes("_")) return s;
  return toEngineKey(s) ?? s;
}

/** Možnosti pro Select/ComboBox – zobrazované labely. */
export const ENGINE_OPTIONS = [
  "1.6 TDI",
  "1.9 TDI",
  "2.0 TDI",
  "2.0 TDI 4x4",
  "1.0 TSI",
  "1.2 TSI",
  "1.4 TSI",
  "1.5 TSI",
  "1.8 TSI",
  "2.0 TSI",
  "RS",
  "DSG",
  "Hybrid",
  "EV",
] as const;
