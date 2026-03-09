import * as React from "react"

import { cn } from "@/lib/utils"
import { formatCurrencyCZK } from "@/lib/ui"

type RangeBarProps = {
  minPrice: number | null
  maxPrice: number | null
  p25Price: number | null
  p75Price: number | null
  medianPrice: number | null
  className?: string
}

export function RangeBar({
  minPrice,
  maxPrice,
  p25Price,
  p75Price,
  medianPrice,
  className,
}: RangeBarProps) {
  const domainMin =
    typeof minPrice === "number"
      ? minPrice
      : typeof p25Price === "number"
        ? p25Price
        : null
  const domainMax =
    typeof maxPrice === "number"
      ? maxPrice
      : typeof p75Price === "number"
        ? p75Price
        : null

  const canRenderScale =
    domainMin != null &&
    domainMax != null &&
    Number.isFinite(domainMin) &&
    Number.isFinite(domainMax) &&
    domainMax > domainMin

  function toPercent(value: number | null): number | null {
    if (!canRenderScale || value == null || !Number.isFinite(value)) return null
    const pct = ((value - domainMin!) / (domainMax! - domainMin!)) * 100
    if (!Number.isFinite(pct)) return null
    return Math.min(100, Math.max(0, pct))
  }

  const p25Pct = toPercent(p25Price)
  const p75Pct = toPercent(p75Price)
  const medianPct = toPercent(medianPrice)

  const minLabel =
    typeof minPrice === "number"
      ? formatCurrencyCZK(minPrice)
      : typeof p25Price === "number"
        ? formatCurrencyCZK(p25Price)
        : null
  const maxLabel =
    typeof maxPrice === "number"
      ? formatCurrencyCZK(maxPrice)
      : typeof p75Price === "number"
        ? formatCurrencyCZK(p75Price)
        : null

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative h-1.5 rounded-full bg-neutral-100">
        {canRenderScale ? (
          <>
            {p25Pct != null &&
              p75Pct != null &&
              p75Pct > p25Pct && (
                <div
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-100 via-indigo-100 to-purple-100"
                  style={{
                    left: `${p25Pct}%`,
                    right: `${100 - p75Pct}%`,
                  }}
                />
              )}
            {medianPct != null && (
              <div
                className="absolute inset-y-[-3px] w-[2px] rounded-full bg-indigo-500"
                style={{ left: `${medianPct}%` }}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 rounded-full bg-neutral-200" />
        )}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span>{minLabel ?? "—"}</span>
          <span>{maxLabel ?? "—"}</span>
        </div>
      )}
    </div>
  )
}

