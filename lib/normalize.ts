import type { MakeKey } from "./cars"

export function normalizeQueryString(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim()
}

export function normalizeMake(value: string | null | undefined): MakeKey | "" {
  const v = normalizeQueryString(stripDiacritics(value ?? ""))
  if (!v) return ""
  if (v === "vw") return "volkswagen"
  // In this demo data, the normalized form already matches MakeKey
  return v as MakeKey
}

export function parseNumberParam(
  value: string | null | undefined,
): number {
  if (value == null || value === "") return Number.NaN
  const n = Number(value)
  return Number.isNaN(n) ? Number.NaN : n
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

const KNOWN_MAKES = [
  "skoda",
  "volkswagen",
  "vw",
  "hyundai",
  "kia",
  "toyota",
  "bmw",
  "audi",
  "mercedes",
  "ford",
  "opel",
  "renault",
  "peugeot",
  "citroen",
  "seat",
  "mazda",
  "honda",
  "nissan",
  "suzuki",
  "volvo",
] as const

type ParsedMakeModel = {
  make?: string
  model?: string
}

export function parseMakeModel(input: string): ParsedMakeModel {
  const cleaned = stripDiacritics(input).trim().replace(/\s+/g, " ")
  if (!cleaned) return {}

  const lower = cleaned.toLowerCase()
  const firstSpaceIdx = lower.indexOf(" ")

  const firstToken =
    firstSpaceIdx === -1 ? lower : lower.slice(0, firstSpaceIdx)
  const restRaw =
    firstSpaceIdx === -1 ? "" : cleaned.slice(firstSpaceIdx + 1).trim()

  const matchedMake = KNOWN_MAKES.find((m) => m === firstToken)
  if (!matchedMake) {
    // No known make at the start: treat whole input as model
    return { model: cleaned }
  }

  const normalizedMake = matchedMake === "vw" ? "volkswagen" : matchedMake

  return {
    make: normalizedMake,
    model: restRaw || undefined,
  }
}

