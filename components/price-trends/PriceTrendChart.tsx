"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart"

type PricePoint = {
  day: string
  median: number | null
  p25: number | null
  p75: number | null
  sample_size: number | null
}

type Props = {
  modelKey: string
  initialPoints?: PricePoint[]
}

export function PriceTrendChart({ modelKey, initialPoints }: Props) {
  const [points, setPoints] = useState<PricePoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (initialPoints && initialPoints.length > 0) {
      setPoints(initialPoints)
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/price-series?model_key=${encodeURIComponent(
            modelKey,
          )}&days=30`,
        )

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`)
        }

        const json = await res.json()
        const pts: PricePoint[] = json.points ?? []

        if (!cancelled) {
          setPoints(pts)
        }
      } catch (err) {
        if (!cancelled) {
          setError("load_failed")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [modelKey])

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">
        Načítám cenový trend…
      </p>
    )
  }

  if (error || !points || points.length < 7) {
    return (
      <p className="text-sm text-muted-foreground">
        Trend se teprve skládá.
      </p>
    )
  }

  const dataForChart = points.map((p) => ({
    dateLabel: p.day ? new Date(p.day).toLocaleDateString("cs-CZ") : "",
    median: p.median,
    p25: p.p25,
    p75: p.p75,
  }))

  return (
    <SafeResponsiveChart className="h-64 w-full min-h-[256px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dataForChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            formatter={(value: unknown): ReactNode =>
              typeof value === "number"
                ? new Intl.NumberFormat("cs-CZ", {
                    style: "currency",
                    currency: "CZK",
                    maximumFractionDigits: 0,
                  }).format(value)
                : String(value ?? "")
            }
          />
          <Area
            type="monotone"
            dataKey="p25"
            stroke="transparent"
            fill="hsl(var(--primary)/0.06)"
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="p75"
            stroke="transparent"
            fill="hsl(var(--primary)/0.06)"
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="median"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </SafeResponsiveChart>
  )
}

