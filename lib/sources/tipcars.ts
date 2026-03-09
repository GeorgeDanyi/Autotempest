import type { SearchParams } from "./types"

const TIPCARS_BASE = "https://www.tipcars.com/ojete"

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export function buildTipcarsUrl(params: SearchParams): string {
  let path = TIPCARS_BASE

  if (params.make && params.model) {
    const makeSlug = slugify(params.make)
    const modelSlug = slugify(params.model)

    if (makeSlug && modelSlug) {
      path = `${TIPCARS_BASE}/${makeSlug}-${modelSlug}`
      const urlWithSlugs = new URL(path)
      return urlWithSlugs.toString()
    }
  }

  const url = new URL(TIPCARS_BASE)

  if (params.q && params.q.trim()) {
    url.searchParams.set("text", params.q.trim())
  }

  return url.toString()
}

