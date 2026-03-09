"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "autotempest-cz-saved-searches"

export type SavedSearch = {
  id: string
  label: string
  query: string
  createdAt: number
}

function safeParse(value: string | null): SavedSearch[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed as SavedSearch[]
    }
  } catch {
    // ignore
  }
  return []
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const fromStorage = safeParse(window.localStorage.getItem(STORAGE_KEY))
    setSearches(fromStorage)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
  }, [searches, hydrated])

  function addSearch(label: string, query: string) {
    const trimmedLabel = label.trim()
    const finalLabel = trimmedLabel || "Hledání"
    const next: SavedSearch = {
      id: createId(),
      label: finalLabel,
      query,
      createdAt: Date.now(),
    }
    setSearches((prev) => [next, ...prev])
  }

  function removeSearch(id: string) {
    setSearches((prev) => prev.filter((item) => item.id !== id))
  }

  return {
    searches,
    hydrated,
    addSearch,
    removeSearch,
  }
}

