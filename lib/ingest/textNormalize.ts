function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function slugifyNoDiacritics(input: string): string {
  const noDia = stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return noDia || "";
}

export function buildModelKey(brand: string, model: string): string {
  return `${slugifyNoDiacritics(brand)}_${slugifyNoDiacritics(model)}`;
}

export function parseIntSafe(s: string | null | undefined): number | null {
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function parsePriceCzk(text: string | null | undefined): number | null {
  return parseIntSafe(text);
}

export function parseMileageKm(text: string | null | undefined): number | null {
  return parseIntSafe(text);
}

export function parseYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const year = parseInt(m[0], 10);
  if (!Number.isFinite(year)) return null;
  if (year < 1900 || year > 2100) return null;
  return year;
}

