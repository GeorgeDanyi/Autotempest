"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { formatModelTitle } from "@/lib/ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type HeroModel = {
  modelKey: string
}

type Props = {
  topModels: HeroModel[]
  liveExamples: HeroModel[]
}

export function HomeHeroSearch({ topModels, liveExamples }: Props) {
  const router = useRouter()
  const [value, setValue] = useState("")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const raw = value.trim()
    if (!raw) return

    const normalized = raw.toLowerCase()

    const match = topModels.find((item) =>
      formatModelTitle(item.modelKey).toLowerCase().includes(normalized),
    )

    if (match) {
      router.push(`/price-trends/${match.modelKey}`)
      return
    }

    const params = new URLSearchParams()
    params.set("q", raw)
    router.push(`/price-trends?${params.toString()}`)
  }

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 -top-28 h-40 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),transparent_60%)]" />
        <div className="relative space-y-3">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Škoda Octavia, VW Golf, Superb…"
                  className="flex-1 h-[60px] rounded-[18px] border-neutral-200/80 bg-white/80 text-sm placeholder:text-[#94A3B8] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_40px_rgba(15,23,42,0.10)] focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:border-transparent focus-visible:ring-offset-0"
                />
                <Button
                  className="h-[60px] shrink-0 rounded-[18px] px-5 text-sm shadow-[0_10px_30px_rgba(15,23,42,0.16)]"
                  type="submit"
                >
                  Zjistit cenu
                </Button>
              </div>
              <p className="text-[11px] text-neutral-500 leading-[1.6]">
                Zadej např. <span className="font-medium">„Škoda Octavia“</span>.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {["Škoda Octavia", "Škoda Superb", "VW Golf", "VW Passat"].map(
                  (label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams()
                        params.set("q", label)
                        router.push(`/price-trends?${params.toString()}`)
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-neutral-700 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition-colors hover:border-neutral-300 hover:bg-white"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500" />
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

