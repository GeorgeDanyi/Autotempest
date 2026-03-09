"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const STORAGE_KEY = "autotempest-cz-waitlist"

type Variant = "home" | "results"

type WaitlistProps = {
  variant?: Variant
}

type WaitlistEntry = {
  email: string
  createdAt: string
  search?: string
}

function readExistingEntries(): WaitlistEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WaitlistEntry[]) : []
  } catch {
    return []
  }
}

export function Waitlist({ variant = "home" }: WaitlistProps) {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")

  const containerClasses =
    variant === "results"
      ? "space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-xs md:text-sm"
      : "space-y-2 rounded-2xl border border-border/70 bg-card/80 p-3 text-xs md:text-sm"

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus("idle")

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setStatus("error")
      return
    }

    if (typeof window === "undefined") {
      return
    }

    try {
      const existing = readExistingEntries()
      const entry: WaitlistEntry = {
        email: trimmedEmail,
        createdAt: new Date().toISOString(),
        search: searchParams ? searchParams.toString() : undefined,
      }

      const updated = [...existing, entry]
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

      setStatus("success")
      setEmail("")
    } catch {
      setStatus("error")
    }
  }

  return (
    <section className={containerClasses}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex-1 space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Zadejte e-mail pro upozornění
          </label>
          <Input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (status !== "idle") setStatus("idle")
            }}
            placeholder="např. jana.novakova@email.cz"
            className="h-8 text-xs md:text-sm"
          />
        </div>
        <Button type="submit" size="sm" className="h-8 rounded-full px-4 text-xs md:text-sm">
          Chci upozornění
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        Pošleme jen info o spuštění živých výsledků. Žádný spam.
      </p>
      {status === "success" && (
        <p className="text-[11px] font-medium text-emerald-600">
          Díky! Jsme v kontaktu.
        </p>
      )}
      {status === "error" && (
        <p className="text-[11px] text-destructive">
          Zkontrolujte prosím e-mail a zkuste to znovu.
        </p>
      )}
    </section>
  )
}

