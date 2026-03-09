/**
 * Validace rozsahů filtrů: yearFrom/yearTo a mileageFrom/mileageTo.
 * Nevalidní rozsahy (from > to) nesmí projít do pricing výpočtu.
 */

export type ValidateRangesReason =
  | "INVALID_YEAR_RANGE_ORDER"
  | "INVALID_MILEAGE_RANGE_ORDER";

export type ValidateRangesResult =
  | { ok: true }
  | {
      ok: false;
      reason: ValidateRangesReason;
      error: string;
    };

function toNum(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseInt(String(value).replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * yearFrom > yearTo je nevalidní.
 * Když je jen jeden z nich, pořadí nevalidujeme.
 */
export function isYearRangeOrderValid(
  yearFrom: string | number | null | undefined,
  yearTo: string | number | null | undefined
): boolean {
  const from = toNum(yearFrom);
  const to = toNum(yearTo);
  if (from == null || to == null) return true;
  return from <= to;
}

/**
 * mileageFrom > mileageTo je nevalidní.
 * Když je jen jeden z nich, pořadí nevalidujeme.
 */
export function isMileageRangeValid(
  mileageFrom: string | number | null | undefined,
  mileageTo: string | number | null | undefined
): boolean {
  const from = toNum(mileageFrom);
  const to = toNum(mileageTo);
  if (from == null || to == null) return true;
  return from <= to;
}

export type ValidateAnalyzeRangesInput = {
  yearFrom?: string | number | null;
  yearTo?: string | number | null;
  mileageFrom?: string | number | null;
  mileageTo?: string | number | null;
};

/**
 * Validuje pořadí roků a nájezdů. První nalezená chyba vrátí reason + error.
 */
export function validateAnalyzeRanges(input: ValidateAnalyzeRangesInput): ValidateRangesResult {
  const { yearFrom, yearTo, mileageFrom, mileageTo } = input;
  if (!isYearRangeOrderValid(yearFrom, yearTo)) {
    return {
      ok: false,
      reason: "INVALID_YEAR_RANGE_ORDER",
      error: "Year from cannot be greater than year to",
    };
  }
  if (!isMileageRangeValid(mileageFrom, mileageTo)) {
    return {
      ok: false,
      reason: "INVALID_MILEAGE_RANGE_ORDER",
      error: "Mileage from cannot be greater than mileage to",
    };
  }
  return { ok: true };
}
