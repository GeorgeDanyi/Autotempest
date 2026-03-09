/**
 * Parse price from search input text.
 * A number is treated as price ONLY if:
 * - the text contains currency markers (kč, kc, czk, ",-"), or
 * - there are two or more large numbers (then the larger is treated as price).
 * Otherwise a single large number (e.g. 200000 in "Škoda Octavia 2015 2.0TDI 200000")
 * is assumed to be mileage only → returns null so it is not used as verifiedPriceCzk.
 */

const CURRENCY_PATTERN = /\b(kč|kc|czk)\b|,\s*-/i;

/** Extract all "large" numbers that could be mileage or price (5–7 digits, or 2–3 digits + k/tis). */
function extractLargeNumbers(text: string): number[] {
  const numbers: number[] = [];

  // 5–7 digit numbers (e.g. 200000, 350 000)
  const plain = text.match(/\d{5,7}/g);
  if (plain) {
    for (const m of plain) {
      const n = parseInt(m.replace(/\D/g, ""), 10);
      if (!Number.isNaN(n) && n >= 5000 && n <= 10_000_000) numbers.push(n);
    }
  }

  // "250k", "250 tis" (thousands)
  const thousands = text.matchAll(/(\d{2,3})\s*(k|tis\b)/gi);
  for (const m of thousands) {
    const base = parseInt(m[1].replace(/\D/g, ""), 10);
    if (!Number.isNaN(base)) {
      const n = base * 1000;
      if (n >= 5000 && n <= 10_000_000) numbers.push(n);
    }
  }

  const unique = [...new Set(numbers)].sort((a, b) => a - b);
  return unique;
}

/** Find a number immediately before or after a currency marker. */
function findPriceNearCurrency(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ");

  // Number before "kč" / "kc" / "czk" / ",-"
  const before = normalized.match(
    /(\d{1,3}(?:\s?\d{3})*)\s*(?:kč|kc|czk|,\s*-)/i,
  );
  if (before) {
    const num = parseInt(before[1].replace(/\s/g, ""), 10);
    if (!Number.isNaN(num) && num >= 1000) return num;
  }

  // "250k" or "250 tis" before currency
  const thousandsBefore = normalized.match(
    /(\d{2,3})\s*(?:k|tis)\s*(?:kč|kc|czk|,\s*-)/i,
  );
  if (thousandsBefore) {
    const base = parseInt(thousandsBefore[1].replace(/\D/g, ""), 10);
    if (!Number.isNaN(base)) return base * 1000;
  }

  return null;
}

/**
 * Parse price (CZK) from search input. Returns null unless price is explicitly indicated
 * (currency markers) or there are two large numbers (mileage + price).
 */
export function parsePriceFromSearchInput(text: string): number | null {
  const input = (text ?? "").trim();
  if (!input) return null;

  const hasCurrency = CURRENCY_PATTERN.test(input);

  if (hasCurrency) {
    const near = findPriceNearCurrency(input);
    if (near != null) return near;
  }

  const largeNumbers = extractLargeNumbers(input);

  if (largeNumbers.length >= 2) {
    const [smaller, larger] = largeNumbers.slice(-2);
    return larger;
  }

  return null;
}
