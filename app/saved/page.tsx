"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type { Car } from "@/lib/cars"
import { SOURCE_DISPLAY_NAMES, carsSample } from "@/lib/cars"
import { useCarNotes } from "@/lib/use-car-notes"
import { useSavedCars } from "@/lib/use-saved-cars"
import { useSavedSearches } from "@/lib/use-saved-searches"
import { CarCard } from "@/components/car-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type Tab = "searches" | "cars"

export default function SavedPage() {
  const router = useRouter()
  const { ids, isSaved, toggle, hydrated } = useSavedCars()
  const { hydrated: notesHydrated, getNote, setNote } = useCarNotes()
  const { searches, hydrated: searchesHydrated, removeSearch } = useSavedSearches()
  const [detailCar, setDetailCar] = useState<Car | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("searches")

  const savedCars = carsSample.filter((car) => ids.includes(car.id))

  const hasSavedSearches = searchesHydrated && searches.length > 0

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Uložené
        </h1>
        <p className="text-sm text-muted-foreground">
          Hledání a vozy, ke kterým se chcete vrátit. Vše ukládáme jen do tohoto
          prohlížeče.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as Tab)}
        className="space-y-4"
      >
        <TabsList className="text-xs" variant="default">
          <TabsTrigger value="searches">Hledání</TabsTrigger>
          <TabsTrigger value="cars">Auta</TabsTrigger>
        </TabsList>

        <TabsContent value="searches">
          <SavedSearchesList
            searches={searches}
            hydrated={searchesHydrated}
            onRun={(query) =>
              router.push(query ? `/results?${query}` : "/results")
            }
            onDelete={removeSearch}
          />
        </TabsContent>

        <TabsContent value="cars">
          <SavedCarsList
            savedCars={savedCars}
            hydrated={hydrated}
            isSaved={isSaved}
            toggle={toggle}
            detailCar={detailCar}
            setDetailCar={setDetailCar}
            notesHydrated={notesHydrated}
            getNote={getNote}
            setNote={setNote}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type SavedSearchesListProps = {
  searches: ReturnType<typeof useSavedSearches>["searches"]
  hydrated: boolean
  onRun: (query: string) => void
  onDelete: (id: string) => void
}

function SavedSearchesList({
  searches,
  hydrated,
  onRun,
  onDelete,
}: SavedSearchesListProps) {
  if (!hydrated) {
    return (
      <p className="text-sm text-muted-foreground">
        Načítáme uložená hledání…
      </p>
    )
  }

  if (searches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/40 p-6 text-sm text-muted-foreground">
        Zatím nemáte žádná uložená hledání. Na stránce výsledků můžete kliknout
        na „Uložit toto hledání“ a rychle se k němu kdykoli vrátit.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {searches.map((search) => {
        const chips = buildChipsFromQuery(search.query)
        return (
          <div
            key={search.id}
            className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/80 p-4 text-sm md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-1">
              <div className="font-medium">{search.label}</div>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {chips.map((chip) => (
                    <Badge
                      key={chip}
                      variant="outline"
                      className="border-dashed bg-muted/60 px-2.5 py-1"
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => onRun(search.query)}
              >
                Spustit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(search.id)}
              >
                Smazat
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

type SavedCarsListProps = {
  savedCars: Car[]
  hydrated: boolean
  isSaved: (id: string) => boolean
  toggle: (id: string) => void
  detailCar: Car | null
  setDetailCar: (car: Car | null) => void
  notesHydrated: boolean
  getNote: (id: string) => string
  setNote: (id: string, value: string) => void
}

function SavedCarsList({
  savedCars,
  hydrated,
  isSaved,
  toggle,
  detailCar,
  setDetailCar,
  notesHydrated,
  getNote,
  setNote,
}: SavedCarsListProps) {
  if (!hydrated) {
    return (
      <p className="text-sm text-muted-foreground">Načítáme uložená auta…</p>
    )
  }

  if (savedCars.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/40 p-6 text-sm text-muted-foreground">
        Zatím nemáte nic uloženého. Na stránce výsledků nebo v budoucnu přímo v
        inzerátech klikněte na ikonu srdíčka u aut, která chcete sledovat.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {savedCars.map((car) => (
          <CarCard
            key={car.id}
            car={car}
            isSaved={isSaved(car.id)}
            onToggleSave={() => toggle(car.id)}
            onOpenDetails={() => setDetailCar(car)}
          />
        ))}
      </div>

      <Sheet
        open={!!detailCar}
        onOpenChange={(open) => {
          if (!open) setDetailCar(null)
        }}
      >
        {detailCar && (
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[420px] sm:border-l">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base font-semibold md:text-lg">
                {detailCar.title}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {new Intl.NumberFormat("cs-CZ", {
                  style: "currency",
                  currency: "CZK",
                  maximumFractionDigits: 0,
                }).format(detailCar.priceCZK)}
              </p>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-4 pt-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  {detailCar.sourceName}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {detailCar.location}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-muted/40 p-3 text-xs">
                <div className="space-y-0.5">
                  <div className="text-[11px] text-muted-foreground">
                    Rok výroby
                  </div>
                  <div className="font-medium">{detailCar.year}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] text-muted-foreground">
                    Najeto
                  </div>
                  <div className="font-medium">
                    {detailCar.mileageKm > 0
                      ? `${new Intl.NumberFormat("cs-CZ", {
                          maximumFractionDigits: 0,
                        }).format(detailCar.mileageKm / 1000)} tis. km`
                      : "neuvedeno"}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] text-muted-foreground">
                    Palivo
                  </div>
                  <div className="font-medium">{detailCar.fuelType}</div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] text-muted-foreground">
                    Převodovka
                  </div>
                  <div className="font-medium">{detailCar.transmission}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="car-note-saved">
                  Poznámka
                </label>
                <Textarea
                  id="car-note-saved"
                  placeholder="Např. domluvit prohlídku, prověřit servisní knížku…"
                  value={notesHydrated && detailCar ? getNote(detailCar.id) : ""}
                  onChange={(event) => {
                    if (!detailCar) return
                    setNote(detailCar.id, event.target.value)
                  }}
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground">
                  Ukládáme jen do tohoto prohlížeče.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button
                  asChild
                  className="w-full justify-center sm:flex-1"
                >
                  <a
                    href={detailCar.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Otevřít u zdroje
                  </a>
                </Button>
                <Button
                  type="button"
                  variant={isSaved(detailCar.id) ? "outline" : "ghost"}
                  className="w-full justify-center text-sm sm:w-auto"
                  onClick={() => toggle(detailCar.id)}
                  aria-pressed={isSaved(detailCar.id)}
                >
                  {isSaved(detailCar.id) ? "Odebrat z uložených" : "Uložit"}
                </Button>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  )
}

function buildChipsFromQuery(query: string): string[] {
  const params = new URLSearchParams(query)

  const makeKey = (params.get("make") ?? "").toLowerCase().trim()
  const model = (params.get("model") ?? "").toLowerCase().trim()
  const priceMin = Number(params.get("priceMin") ?? "")
  const priceMax = Number(params.get("priceMax") ?? "")
  const yearMin = Number(params.get("yearMin") ?? "")
  const mileageMaxThousands = Number(params.get("mileageMax") ?? "")
  const fuel = (params.get("fuel") ?? "").toLowerCase().trim()
  const transmission = (params.get("transmission") ?? "").toLowerCase().trim()
  const location = params.get("location") ?? ""
  const radius = params.get("radius") ?? ""
  const sources = params.getAll("source")
  const sort = (params.get("sort") ?? "").toLowerCase().trim()

  const chips: string[] = []

  if (makeKey) chips.push(`Značka: ${makeKey}`)
  if (model) chips.push(`Model: ${model}`)
  if (!Number.isNaN(priceMin) && priceMin > 0) {
    chips.push(`Cena od ${priceMin.toLocaleString("cs-CZ")} Kč`)
  }
  if (!Number.isNaN(priceMax) && priceMax > 0) {
    chips.push(`Cena do ${priceMax.toLocaleString("cs-CZ")} Kč`)
  }
  if (!Number.isNaN(yearMin) && yearMin > 0) {
    chips.push(`Rok od ${yearMin}`)
  }
  if (!Number.isNaN(mileageMaxThousands) && mileageMaxThousands > 0) {
    chips.push(`Najeto do ${mileageMaxThousands} tis. km`)
  }
  if (fuel) {
    chips.push(`Palivo: ${fuel}`)
  }
  if (transmission) {
    chips.push(`Převodovka: ${transmission}`)
  }
  if (location) {
    chips.push(`Lokalita: ${location}`)
  }
  if (radius) {
    chips.push(`Radius: ${radius === "all" ? "Celá ČR" : `+ ${radius} km`}`)
  }
  sources.forEach((sourceKey) => {
    const display =
      SOURCE_DISPLAY_NAMES[sourceKey as keyof typeof SOURCE_DISPLAY_NAMES] ??
      sourceKey
    chips.push(`Zdroj: ${display}`)
  })
  if (sort) {
    const sortLabel =
      sort === "priceasc"
        ? "Cena ↑"
        : sort === "pricedesc"
          ? "Cena ↓"
          : sort === "yeardesc"
            ? "Rok ↓"
            : "Nájezd ↑"
    chips.push(`Řazení: ${sortLabel}`)
  }

  return chips
}

