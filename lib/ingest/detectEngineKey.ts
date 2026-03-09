function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Výrazy, které nejsou motor / pohon – nesmí se vrátit jako engine_key.
 * Trim (scout, style, ambition, sportline, laurin_klement), převodovka (dsg, automatic, manual),
 * marketing (rs), pohony (4x4, awd, fwd, rwd) – při detekci se ignorují, vrátí se null.
 */
const EXCLUDED_ENGINE_LIKE = new Set([
  "dsg",
  "automatic",
  "manual",
  "rs",
  "scout",
  "style",
  "ambition",
  "sportline",
  "laurin_klement",
  "4x4",
  "awd",
  "fwd",
  "rwd",
]);

/**
 * Detect engine/drivetrain variant from free text.
 * Returns a normalized engine_key only when objem + typ motoru is clearly recognizable
 * (TDI, TSI, TFSI, CRDi, HDi, EcoBlue, EcoBoost, dCi, CDI, TCe, EV, hybrid, PHEV, LPG).
 * Trim, převodovka a marketingová označení se nevracejí – v takovém případě null.
 */
export function detectEngineKey(text: string): string | null {
  const norm = normalize(text);

  // Diesel TDI – pouze konkrétní objemy
  if (/\b(?:3[.,\s]*0|30)[.,\s]*tdi\b/.test(norm)) return "3_0_tdi";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*tdi\b/.test(norm)) return "2_0_tdi";
  if (/\b(?:1[.,\s]*9|19)[.,\s]*tdi\b/.test(norm)) return "1_9_tdi";
  if (/\b(?:1[.,\s]*6|16)[.,\s]*tdi\b/.test(norm)) return "1_6_tdi";

  // Benzín TSI
  if (/\b(?:1[.,\s]*0|10)[.,\s]*tsi\b/.test(norm)) return "1_0_tsi";
  if (/\b(?:1[.,\s]*2|12)[.,\s]*tsi\b/.test(norm)) return "1_2_tsi";
  if (/\b(?:1[.,\s]*4|14)[.,\s]*tsi\b/.test(norm)) return "1_4_tsi";
  if (/\b(?:1[.,\s]*5|15)[.,\s]*tsi\b/.test(norm)) return "1_5_tsi";
  if (/\b(?:1[.,\s]*8|18)[.,\s]*tsi\b/.test(norm)) return "1_8_tsi";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*tsi\b/.test(norm)) return "2_0_tsi";

  // Benzín TFSI (Audi/VW)
  if (/\b(?:1[.,\s]*0|10)[.,\s]*tfsi\b/.test(norm)) return "1_0_tfsi";
  if (/\b(?:1[.,\s]*2|12)[.,\s]*tfsi\b/.test(norm)) return "1_2_tfsi";
  if (/\b(?:1[.,\s]*4|14)[.,\s]*tfsi\b/.test(norm)) return "1_4_tfsi";
  if (/\b(?:1[.,\s]*8|18)[.,\s]*tfsi\b/.test(norm)) return "1_8_tfsi";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*tfsi\b/.test(norm)) return "2_0_tfsi";
  if (/\b(?:3[.,\s]*0|30)[.,\s]*tfsi\b/.test(norm)) return "3_0_tfsi";

  // Diesel CRDi (Hyundai/Kia)
  if (/\b(?:1[.,\s]*7|17)[.,\s]*crdi\b/.test(norm)) return "1_7_crdi";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*crdi\b/.test(norm)) return "2_0_crdi";
  if (/\b(?:2[.,\s]*2|22)[.,\s]*crdi\b/.test(norm)) return "2_2_crdi";

  // Diesel HDi (PSA)
  if (/\b(?:1[.,\s]*4|14)[.,\s]*hdi\b/.test(norm)) return "1_4_hdi";
  if (/\b(?:1[.,\s]*6|16)[.,\s]*hdi\b/.test(norm)) return "1_6_hdi";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*hdi\b/.test(norm)) return "2_0_hdi";
  if (/\b(?:2[.,\s]*2|22)[.,\s]*hdi\b/.test(norm)) return "2_2_hdi";

  // Diesel EcoBlue (Ford)
  if (/\b(?:1[.,\s]*5|15)[.,\s]*ecoblue\b/.test(norm)) return "1_5_ecoblue";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*ecoblue\b/.test(norm)) return "2_0_ecoblue";
  if (/\b(?:3[.,\s]*0|30)[.,\s]*ecoblue\b/.test(norm)) return "3_0_ecoblue";

  // Benzín EcoBoost (Ford)
  if (/\b(?:1[.,\s]*0|10)[.,\s]*ecoboost\b/.test(norm)) return "1_0_ecoboost";
  if (/\b(?:1[.,\s]*5|15)[.,\s]*ecoboost\b/.test(norm)) return "1_5_ecoboost";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*ecoboost\b/.test(norm)) return "2_0_ecoboost";
  if (/\b(?:2[.,\s]*3|23)[.,\s]*ecoboost\b/.test(norm)) return "2_3_ecoboost";

  // Diesel dCi (Renault/Nissan)
  if (/\b(?:1[.,\s]*5|15)[.,\s]*dci\b/.test(norm)) return "1_5_dci";
  if (/\b(?:1[.,\s]*6|16)[.,\s]*dci\b/.test(norm)) return "1_6_dci";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*dci\b/.test(norm)) return "2_0_dci";

  // Diesel CDI (Mercedes)
  if (/\b(?:1[.,\s]*6|16)[.,\s]*cdi\b/.test(norm)) return "1_6_cdi";
  if (/\b(?:2[.,\s]*0|20)[.,\s]*cdi\b/.test(norm)) return "2_0_cdi";
  if (/\b(?:2[.,\s]*2|22)[.,\s]*cdi\b/.test(norm)) return "2_2_cdi";
  if (/\b(?:3[.,\s]*0|30)[.,\s]*cdi\b/.test(norm)) return "3_0_cdi";

  // Benzín TCe (Renault/Nissan)
  if (/\b(?:0[.,\s]*9|09)[.,\s]*tce\b/.test(norm)) return "0_9_tce";
  if (/\b(?:1[.,\s]*0|10)[.,\s]*tce\b/.test(norm)) return "1_0_tce";
  if (/\b(?:1[.,\s]*2|12)[.,\s]*tce\b/.test(norm)) return "1_2_tce";
  if (/\b(?:1[.,\s]*3|13)[.,\s]*tce\b/.test(norm)) return "1_3_tce";
  if (/\b(?:1[.,\s]*5|15)[.,\s]*tce\b/.test(norm)) return "1_5_tce";

  // Elektro a hybridy (skutečný pohon)
  if (/\b(?:ev|electric|elektro|bev)\b/.test(norm)) return "ev";
  if (/\b(?:phev|plug[-\s]?in\s*hybrid|plug-in)\b/.test(norm)) return "phev";
  if (/\bhybrid\b/.test(norm)) return "hybrid";

  // LPG/CNG
  if (/\b(?:lpg|cng)\b/.test(norm)) return "lpg";

  // Nesmíme vrátit nic z blacklistu (např. samotné "rs", "dsg" v textu bez motoru)
  // – výše už vracíme jen konkrétní TDI/TSI/ev/hybrid/phev/lpg, takže rs/dsg/trim se sem nedostanou.
  return null;
}
