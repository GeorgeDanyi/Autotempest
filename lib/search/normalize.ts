export function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function normalizeSpaces(str: string): string {
  return str.trim().replace(/\s+/g, " ")
}

export function slugify(str: string): string {
  const withoutDiacritics = removeDiacritics(str).toLowerCase()
  const spaced = normalizeSpaces(withoutDiacritics)
  return spaced.replace(/\s+/g, "-")
}

export function normalizeForSearch(str: string): string {
  if (!str) return ""
  const lowered = removeDiacritics(str).toLowerCase()
  return normalizeSpaces(lowered)
}


