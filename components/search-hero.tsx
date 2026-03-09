"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { parseMakeModel } from "@/lib/search/parse-make-model"
import { searchParamsToObject, trackEvent } from "@/lib/events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SearchState = {
  brandModel: string
  priceMin: string
  priceMax: string
  location: string
  radius: string
  yearMin: string
  mileageMax: string
  fuel: string
  transmission: string
}

const defaultState: SearchState = {
  brandModel: "",
  priceMin: "",
  priceMax: "",
  location: "",
  radius: "",
  yearMin: "",
  mileageMax: "",
  fuel: "",
  transmission: "",
}

const BRAND_MODEL_PRESETS = [
  "Škoda Octavia",
  "Škoda Fabia",
  "Škoda Kodiaq",
  "Volkswagen Golf",
  "Volkswagen Passat",
  "Hyundai i30",
  "Kia Ceed",
  "Toyota Corolla",
  "BMW 3",
  "Audi A4",
]

export function SearchHero() {
  const router = useRouter()
  const [values, setValues] = useState<SearchState>(defaultState)

  function update<K extends keyof SearchState>(key: K, value: SearchState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const rawQuery = values.brandModel.trim()

    const params = new URLSearchParams()

    if (rawQuery) {
      params.set("q", rawQuery)
    }

    const parsed = parseMakeModel(rawQuery || values.brandModel)
    if (parsed.make) {
      params.set("make", parsed.make)
    }
    if (parsed.model) {
      params.set("model", parsed.model)
    }

    if (values.priceMin) {
      params.set("priceMin", values.priceMin)
    }
    if (values.priceMax) {
      params.set("priceMax", values.priceMax)
    }
    if (values.location) {
      params.set("location", values.location)
    }
    if (values.radius) {
      params.set("radius", values.radius)
    }
    if (values.yearMin) {
      params.set("yearMin", values.yearMin)
    }
    if (values.mileageMax) {
      params.set("mileageMax", values.mileageMax)
    }
    if (values.fuel) {
      params.set("fuel", values.fuel)
    }
    if (values.transmission) {
      params.set("transmission", values.transmission)
    }

    const query = params.toString()

    trackEvent({
      type: "search_submit",
      params: searchParamsToObject(params),
      ts: Date.now(),
    })

    router.push(`/results${query ? `?${query}` : ""}`)
  }

  return (
    <section className="w-full max-w-xl space-y-5 rounded-3xl border border-border/70 bg-card/90 p-5 shadow-lg shadow-black/5 backdrop-blur-md md:p-6">
      <div className="space-y-2">
        <p className="inline-flex rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
          Beta verze · český trh
        </p>
        <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
          Najděte své další auto{" "}
          <span className="text-primary">bez zbytečného šumu</span>.
        </h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          Jednoduché zadání, čisté výsledky z více českých bazarů.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Značka / model
          </label>
          <div className="space-y-1.5">
            <Input
              placeholder='Začněte psát např. "Octavia" nebo "Škoda Octavia"'
              value={values.brandModel}
              onChange={(e) => update("brandModel", e.target.value)}
            />
            {values.brandModel.trim().length > 0 && (
              <div className="space-x-1 space-y-1 text-[11px] text-muted-foreground">
                {BRAND_MODEL_PRESETS.filter((preset) =>
                  preset.toLowerCase().includes(values.brandModel.toLowerCase()),
                )
                  .slice(0, 4)
                  .map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => update("brandModel", preset)}
                      className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] hover:bg-muted/80"
                    >
                      {preset}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Cena od
            </label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="200 000"
              value={values.priceMin}
              onChange={(e) => update("priceMin", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Cena do
            </label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="600 000"
              value={values.priceMax}
              onChange={(e) => update("priceMax", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Lokalita
            </label>
            <Input
              placeholder="Praha, Brno, Ostrava…"
              value={values.location}
              onChange={(e) => update("location", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Radius
            </label>
            <Select
              value={values.radius}
              onValueChange={(value) => update("radius", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Celá ČR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">+ 10 km</SelectItem>
                <SelectItem value="25">+ 25 km</SelectItem>
                <SelectItem value="50">+ 50 km</SelectItem>
                <SelectItem value="100">+ 100 km</SelectItem>
                <SelectItem value="200">+ 200 km</SelectItem>
                <SelectItem value="all">Celá ČR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Accordion
          type="single"
          collapsible
          className="overflow-hidden rounded-2xl border border-dashed border-border/80 bg-muted/40"
        >
          <AccordionItem value="advanced">
            <AccordionTrigger className="px-3">
              <div className="flex flex-col items-start gap-0.5">
                <span>Pokročilé filtry</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Palivo, převodovka, rok výroby, nájezd…
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Palivo
                  </label>
                  <Select
                    value={values.fuel}
                    onValueChange={(value) => update("fuel", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Neřeším" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="benzín">Benzín</SelectItem>
                      <SelectItem value="nafta">Nafta</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="elektro">Elektro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Převodovka
                  </label>
                  <Select
                    value={values.transmission}
                    onValueChange={(value) => update("transmission", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Neřeším" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manuál">Manuál</SelectItem>
                      <SelectItem value="automat">Automat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Rok od
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="2016"
                    value={values.yearMin}
                    onChange={(e) => update("yearMin", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Najeto do (tis. km)
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="150"
                    value={values.mileageMax}
                    onChange={(e) => update("mileageMax", e.target.value)}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            className="h-11 w-full rounded-full text-sm font-medium sm:w-auto sm:px-7"
          >
            Hledat auta
          </Button>
          <p className="text-xs text-muted-foreground">
            Žádné registrace. Inzeráty otevřeme přímo na zdrojových webech.
          </p>
        </div>
      </form>
    </section>
  )
}

