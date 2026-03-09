const STORAGE_KEY = "autotempest-cz-events"

export type EventParams = Record<string, string | string[]>

export type BaseEvent = {
  type: string
  ts: number
  params?: EventParams
  [key: string]: unknown
}

type StoredEvent = BaseEvent

type ParamsLike = {
  forEach: (callback: (value: string, key: string) => void) => void
}

export function searchParamsToObject(params: ParamsLike): EventParams {
  const result: EventParams = {}

  params.forEach((value, key) => {
    const existing = result[key]
    if (existing === undefined) {
      result[key] = value
    } else if (Array.isArray(existing)) {
      result[key] = [...existing, value]
    } else {
      result[key] = [existing, value]
    }
  })

  return result
}

function readExistingEvents(): StoredEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredEvent[]) : []
  } catch {
    return []
  }
}

export function trackEvent(event: BaseEvent) {
  if (typeof window === "undefined") return

  try {
    const existing = readExistingEvents()
    const next: StoredEvent[] = [...existing, event].slice(-200)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Swallow errors to avoid impacting UX
  }
}

