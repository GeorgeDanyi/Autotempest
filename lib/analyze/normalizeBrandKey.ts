/**
 * Oddělení interního brand key (URL/state) a display label (UI).
 * - brand key = stabilní hodnota: skoda, bmw, land_rover, mercedes_benz
 * - brand label = hodnota pro UI: Škoda, BMW, Land Rover, Mercedes-Benz
 * Nikdy nepoužívat raw DB value přímo jako UI label.
 */

/** Odstraní diakritiku (NFD + strip combining marks). */
function removeDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vyčistí špinavý vstup před vytvořením key:
 * trim, čárky/tečky/pomlčky → mezera, více mezer → jedna, lowercase,
 * odstranit diakritiku, mezery a underscore sjednotit na jeden underscore.
 * "Land Rover" → "land_rover", "Mini," → "mini", "Mercedes-Benz" → "mercedes_benz".
 */
export function normalizeBrandKey(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  let t = s
    .trim()
    .replace(/[,.\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  t = removeDiacritics(t);
  t = t.replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (t === "vw") t = "volkswagen";
  return t || "";
}

/**
 * Explicitní mapování známých značek: key → display label.
 * value = brand key (pro URL/state), label = pro UI/DB.
 * Přidány aliasy pro neúplný vstup ze zdrojů: land → Land Rover.
 */
const BRAND_KEY_TO_LABEL: Record<string, string> = {
  skoda: "Škoda",
  bmw: "BMW",
  audi: "Audi",
  volkswagen: "Volkswagen",
  mercedes_benz: "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  land_rover: "Land Rover",
  land: "Land Rover",
  mini: "MINI",
  opel: "Opel",
  peugeot: "Peugeot",
  renault: "Renault",
  citroen: "Citroën",
  alfa_romeo: "Alfa Romeo",
  ford: "Ford",
  toyota: "Toyota",
  honda: "Honda",
  hyundai: "Hyundai",
  kia: "Kia",
  mazda: "Mazda",
  nissan: "Nissan",
  suzuki: "Suzuki",
  volvo: "Volvo",
  seat: "SEAT",
  cupra: "CUPRA",
  dacia: "Dacia",
  jeep: "Jeep",
  fiat: "Fiat",
  porsche: "Porsche",
  jaguar: "Jaguar",
  lexus: "Lexus",
  tesla: "Tesla",
  smart: "smart",
  ds: "DS",
  mg: "MG",
};

/**
 * Vrací hezký display label pro daný brand key.
 * Použije explicitní mapování, jinak title-case z key (land_rover → Land Rover).
 */
export function formatBrandLabelFromKey(key: string | null | undefined): string {
  if (key == null || key === "") return "";
  const k = key.trim().toLowerCase();
  if (BRAND_KEY_TO_LABEL[k]) return BRAND_KEY_TO_LABEL[k];
  return k
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normalizuje raw značku ze zdroje (Sauto, TipCars) na konzistentní display hodnotu pro DB/UI.
 * Používá stejné mapování jako filter-options: raw → key (normalizeBrandKey) → label (formatBrandLabelFromKey).
 * Do market_observations.brand ukládej vždy výsledek této funkce, ne raw string.
 *
 * Příklady: "Skoda" → "Škoda", "Bmw" → "BMW", "Land" → "Land Rover", "Land Rover" → "Land Rover".
 */
export function normalizeBrandForDb(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  const key = normalizeBrandKey(t);
  if (!key) return null;
  const label = formatBrandLabelFromKey(key);
  return label || null;
}
