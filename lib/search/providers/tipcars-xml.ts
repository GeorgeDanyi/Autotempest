import { XMLParser } from "fast-xml-parser"

import type { SearchParams } from "@/lib/sources/types"
import type { CarResult } from "@/lib/search/types"

const DEFAULT_TIMEOUT_MS = 8000

type TipCarsSearchParams = SearchParams

type TipCarsXmlListing = {
  id?: string | number
  title?: string
  price?: string | number
  year?: string | number
  mileage?: string | number
  fuel?: string
  transmission?: string
  location?: string
  url?: string
}

type TipCarsXmlResponse = {
  export?: {
    listing?: TipCarsXmlListing[] | TipCarsXmlListing
  }
}

function buildTipCarsUrl(baseUrl: string, params: TipCarsSearchParams): string {
  const url = new URL(baseUrl)

  if (params.make) {
    url.searchParams.set("make", params.make)
  }
  if (params.model) {
    url.searchParams.set("model", params.model)
  }
  if (params.priceMin && params.priceMin > 0) {
    url.searchParams.set("priceMin", String(params.priceMin))
  }
  if (params.priceMax && params.priceMax > 0) {
    url.searchParams.set("priceMax", String(params.priceMax))
  }
  if (params.yearMin && params.yearMin > 0) {
    url.searchParams.set("yearMin", String(params.yearMin))
  }
  if (params.mileageMax && params.mileageMax > 0) {
    url.searchParams.set("mileageMax", String(params.mileageMax))
  }

  return url.toString()
}

function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, ms)

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  }
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, "").replace(/[^\d]/g, "")
    if (!trimmed) return undefined
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const v = value.trim()
    return v ? v : undefined
  }
  return undefined
}

function mapListingToCarResult(listing: TipCarsXmlListing): CarResult | null {
  const idRaw = listing.id ?? listing.url
  const id = normalizeString(
    typeof idRaw === "number" ? String(idRaw) : (idRaw as string | undefined),
  )
  const title = normalizeString(listing.title)
  const price = normalizeNumber(listing.price)
  const year = normalizeNumber(listing.year)
  const mileage = normalizeNumber(listing.mileage)
  const fuel = normalizeString(listing.fuel)
  const transmission = normalizeString(listing.transmission)
  const location = normalizeString(listing.location)
  const sourceUrl = normalizeString(listing.url)

  if (!id || !title || !price || !year || !sourceUrl) {
    return null
  }

  return {
    id,
    title,
    price,
    year,
    mileage: mileage ?? 0,
    fuel: fuel ?? "",
    transmission: transmission ?? "",
    location: location ?? "",
    sourceKey: "tipcars",
    sourceName: "TipCars",
    sourceUrl,
  }
}

export async function fetchTipCarsXml(
  params: TipCarsSearchParams,
): Promise<CarResult[]> {
  const baseUrl = process.env.TIPCARS_XML_EXPORT_URL
  if (!baseUrl) return []

  const url = buildTipCarsUrl(baseUrl, params)

  const timeout = withTimeout(undefined, DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "GET",
      next: { revalidate: 300 },
      signal: timeout.signal,
    })

    if (!response.ok) {
      return []
    }

    const text = await response.text()
    if (!text.trim()) {
      return []
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      allowBooleanAttributes: true,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
    })

    const parsed = parser.parse(text) as TipCarsXmlResponse
    const listing = parsed.export?.listing
    if (!listing) return []

    const listingsArray = Array.isArray(listing) ? listing : [listing]

    const mapped = listingsArray
      .map((item) => {
        try {
          return mapListingToCarResult(item)
        } catch {
          return null
        }
      })
      .filter((item): item is CarResult => item !== null)

    return mapped
  } catch {
    return []
  } finally {
    timeout.clear()
  }
}

