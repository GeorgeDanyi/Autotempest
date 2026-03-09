import type { SearchParams } from "./types"
import { buildSautoUrl } from "./sauto"
import { buildTipcarsUrl } from "./tipcars"
import { buildBazosUrl } from "./bazos"

export function buildAllSourceUrls(params: SearchParams) {
  return {
    sauto: buildSautoUrl(params),
    tipcars: buildTipcarsUrl(params),
    bazos: buildBazosUrl(params),
  }
}


