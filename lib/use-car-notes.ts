"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "autotempest-cz-car-notes"

type NotesMap = Record<string, string>

function safeParse(value: string | null): NotesMap {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === "object") {
      return parsed as NotesMap
    }
  } catch {
    // ignore
  }
  return {}
}

export function useCarNotes() {
  const [notes, setNotes] = useState<NotesMap>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const fromStorage = safeParse(window.localStorage.getItem(STORAGE_KEY))
    setNotes(fromStorage)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes, hydrated])

  function getNote(id: string) {
    return notes[id] ?? ""
  }

  function setNote(id: string, value: string) {
    setNotes((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  return {
    hydrated,
    getNote,
    setNote,
  }
}

