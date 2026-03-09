"use client"

import { ExternalLinkIcon, HeartIcon, MapPinIcon } from "lucide-react"

import type { Car } from "@/lib/cars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Props = {
  car: Car
  isSaved: boolean
  onToggleSave: () => void
  onOpenDetails?: () => void
}

export function CarCard({ car, isSaved, onToggleSave, onOpenDetails }: Props) {
  const price = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(car.priceCZK)

  const mileage =
    car.mileageKm > 0
      ? new Intl.NumberFormat("cs-CZ", {
          maximumFractionDigits: 0,
        }).format(car.mileageKm / 1000) + " tis. km"
      : "neuvedeno"

  function handleCardClick() {
    if (!onOpenDetails) return
    onOpenDetails()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!onOpenDetails) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpenDetails()
    }
  }

  return (
    <article
      className="group flex cursor-pointer gap-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-xs transition-colors hover:border-primary/60"
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="mt-1 hidden h-20 w-24 flex-none rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20 sm:block" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold leading-snug md:text-base">
              {car.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{car.year}</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{mileage}</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{car.fuelType}</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{car.transmission}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold md:text-base">{price}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              orientační cena
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <ExternalLinkIcon className="size-3" />
              {car.sourceName}
            </Badge>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPinIcon className="size-3" />
              {car.location}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={(event) => event.stopPropagation()}
            >
              <a href={car.sourceUrl} target="_blank" rel="noreferrer">
                Otevřít inzerát
              </a>
            </Button>
            <Button
              type="button"
              variant={isSaved ? "default" : "outline"}
              size="icon-sm"
              className="rounded-full"
              onClick={(event) => {
                event.stopPropagation()
                onToggleSave()
              }}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Odebrat z uložených" : "Uložit inzerát"}
            >
              <HeartIcon
                className={`size-4 ${
                  isSaved ? "fill-primary-foreground" : "fill-transparent"
                }`}
              />
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

