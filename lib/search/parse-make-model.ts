import { normalizeSpaces, removeDiacritics } from "./normalize"

export type ParsedMakeModel = {
  make?: string
  model?: string
}

const MAKE_ALIASES: Record<string, string> = {
  skoda: "skoda",
  volkswagen: "volkswagen",
  vw: "volkswagen",
  hyundai: "hyundai",
  kia: "kia",
  toyota: "toyota",
  bmw: "bmw",
  audi: "audi",
  mercedes: "mercedes",
  ford: "ford",
  opel: "opel",
  renault: "renault",
  peugeot: "peugeot",
  citroen: "citroen",
  seat: "seat",
  mazda: "mazda",
  honda: "honda",
  nissan: "nissan",
  suzuki: "suzuki",
  volvo: "volvo",
}

export function parseMakeModel(input: string): ParsedMakeModel {
  const trimmed = normalizeSpaces(input || "")
  if (!trimmed) return {}

  const firstSpaceIndex = trimmed.indexOf(" ")
  const firstWord =
    firstSpaceIndex === -1 ? trimmed : trimmed.slice(0, firstSpaceIndex)
  const rest = firstSpaceIndex === -1 ? "" : trimmed.slice(firstSpaceIndex + 1).trim()

  const normalizedFirst = removeDiacritics(firstWord).toLowerCase()

  const canonicalMake = MAKE_ALIASES[normalizedFirst]
  if (!canonicalMake) {
    return { model: trimmed }
  }

  return {
    make: canonicalMake,
    model: rest || undefined,
  }
}

