import type { SearchParams } from "./types"

const BAZOS_BASE = "https://auto.bazos.cz/"

export function buildBazosUrl(params: SearchParams): string {
  const url = new URL(BAZOS_BASE)

  const q =
    (params.q && params.q.trim()) ||
    [params.make, params.model].filter(Boolean).join(" ").trim()
  if (q) {
    url.searchParams.set("hledat", q)
  }

  if (params.priceMin && params.priceMin > 0) {
    url.searchParams.set("cenaod", String(params.priceMin))
  }
  if (params.priceMax && params.priceMax > 0) {
    url.searchParams.set("cenado", String(params.priceMax))
  }

  return url.toString()
}

