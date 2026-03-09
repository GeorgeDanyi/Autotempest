"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "autotempest-cz-saved"

function safeParse(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export function useSavedCars() {
  const [ids, setIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const fromStorage = safeParse(window.localStorage.getItem(STORAGE_KEY))
    setIds(fromStorage)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }, [ids, hydrated])

  function toggle(id: string) {
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function isSaved(id: string) {
    return ids.includes(id)
  }

  return {
    ids,
    isSaved,
    toggle,
    hydrated,
  }
}

