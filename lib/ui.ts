export { cn } from "./utils";

const currencyFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatCurrencyCZK(value: number) {
  if (!Number.isFinite(value)) return "–";
  return currencyFormatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateCZ(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}

const BRAND_OVERRIDES: Record<string, string> = {
  bmw: "BMW",
  vw: "VW",
  audi: "Audi",
  skoda: "Škoda",
  "mercedes-benz": "Mercedes-Benz",
  mercedes: "Mercedes",
};

export function formatModelTitle(modelKey: string) {
  if (!modelKey) return "";

  const words = modelKey
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word) => {
      const base = word.toLowerCase();

      if (BRAND_OVERRIDES[base]) {
        return BRAND_OVERRIDES[base];
      }

      if (word === word.toUpperCase() && word.length > 1) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export const typeScale = {
  h1: "text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl",
  h2: "text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl",
  body: "text-base text-neutral-700",
  muted: "text-sm text-muted-foreground",
} as const;


