"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"

import { searchParamsToObject, trackEvent } from "@/lib/events"
import { Button } from "@/components/ui/button"

type SourceUrls = {
  sauto: string
  tipcars: string
  bazos: string
}

type Props = {
  urls: SourceUrls
}

export function SourceLinksBar({ urls }: Props) {
  const searchParams = useSearchParams()

  const paramsObject = useMemo(() => {
    const base = searchParamsToObject(searchParams)
    const rawQ = (searchParams.get("q") ?? "").trim()
    const make = (searchParams.get("make") ?? "").trim()
    const model = (searchParams.get("model") ?? "").trim()

    const effectiveQ =
      rawQ || [make, model].filter((part) => part.length > 0).join(" ").trim()

    if (effectiveQ) {
      base.q = effectiveQ
    }

    return base
  }, [searchParams])

  function handleClick(source: "sauto" | "tipcars" | "bazos") {
    trackEvent({
      type: "source_click",
      source,
      params: paramsObject,
      ts: Date.now(),
    })
  }

  return (
    <section className="space-y-2 rounded-2xl border border-border/70 bg-card/80 p-3 text-xs md:text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-xs md:text-sm">
          Zobrazit výsledky přímo na:
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => handleClick("sauto")}
            >
              <a href={urls.sauto} target="_blank" rel="noopener noreferrer">
                Sauto.cz
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => handleClick("tipcars")}
            >
              <a href={urls.tipcars} target="_blank" rel="noopener noreferrer">
                TipCars
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => handleClick("bazos")}
            >
              <a href={urls.bazos} target="_blank" rel="noopener noreferrer">
                Bazoš
              </a>
            </Button>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Inzeráty otevřeme přímo na stránkách zdrojů.
      </p>
      <p className="text-[11px] font-medium text-muted-foreground">
        Toto je aktuálně jediný způsob, jak zobrazit reálné výsledky.
      </p>
    </section>
  )
}

