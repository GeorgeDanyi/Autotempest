"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart"
import { formatModelTitle } from "@/lib/ui"

type PageProps = {
  params: {
    model_key: string
  }
}

type PriceDistributionPoint = {
  segment: "Cheap" | "Fair price" | "Overpriced"
  value: number
  bucket: string
  color: string
}

const distributionChartData: PriceDistributionPoint[] = [
  {
    segment: "Cheap",
    bucket: "All",
    value: 22,
    color: "#22C55E",
  },
  {
    segment: "Fair price",
    bucket: "All",
    value: 54,
    color: "#5B8CFF",
  },
  {
    segment: "Overpriced",
    bucket: "All",
    value: 24,
    color: "#F97373",
  },
]

type TrendPoint = {
  month: string
  price: number
}

const mockTrendData: TrendPoint[] = [
  { month: "Apr", price: 374000 },
  { month: "May", price: 371000 },
  { month: "Jun", price: 369000 },
  { month: "Jul", price: 366000 },
  { month: "Aug", price: 364000 },
  { month: "Sep", price: 362000 },
  { month: "Oct", price: 361000 },
  { month: "Nov", price: 360000 },
  { month: "Dec", price: 359500 },
  { month: "Jan", price: 359000 },
  { month: "Feb", price: 359000 },
  { month: "Mar", price: 359000 },
]

export default function PriceTrendsPage({ params }: PageProps) {
  const { model_key: modelKey } = params
  const modelTitle = formatModelTitle(modelKey)

  const [price, setPrice] = useState(0)
  const targetPrice = 359000

  useEffect(() => {
    const duration = 900
    const start = performance.now()

    let frameId: number

    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setPrice(Math.round(targetPrice * eased))
      if (t < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [])

  const trendSixMonths = useMemo(() => {
    const lastIndex = mockTrendData.length - 1
    const sixMonthsBackIndex = Math.max(0, lastIndex - 6)
    const last = mockTrendData[lastIndex].price
    const sixMonthsBack = mockTrendData[sixMonthsBackIndex].price
    const changePct = ((last - sixMonthsBack) / sixMonthsBack) * 100
    return {
      value: changePct,
      label: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(
        1,
      )}% za posledních 6 měsíců`,
      isPositive: changePct >= 0,
    }
  }, [])

  const displayedPrice = Math.round(price)

  return (
    <div className="space-y-8 bg-[#0F1115] px-3 py-8 text-[#E6E8EC] sm:px-4 lg:space-y-10 lg:rounded-3xl lg:px-6">
      <header className="space-y-4">
        <nav className="text-xs text-[#6B7280]">
          <Link href="/price-trends" className="hover:text-[#E6E8EC]">
            Price Trends
          </Link>
          <span className="mx-1 text-[#4B5563]">/</span>
          <span className="text-[#9CA3AF]">{modelTitle}</span>
        </nav>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#262B36] bg-[#171A21] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5B8CFF]" />
              Price Trends CZ
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#E6E8EC] md:text-3xl">
                {modelTitle}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-[#9CA3AF]">
                Dark, data-first dashboard pro reálné tržní ceny ojetých aut v ČR.
              </p>
            </div>
          </div>
          <div className="text-xs text-right text-[#6B7280]">
            <p>Mock data · žádné live napojení</p>
          </div>
        </div>
      </header>

      <section className="space-y-6">
        <div className="rounded-2xl border border-[#262B36] bg-gradient-to-br from-[#171A21] to-[#0C0F16] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.85)] sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 space-y-5">
              <div className="space-y-3">
                <label
                  htmlFor="modelSearch"
                  className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]"
                >
                  Hero data search
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-[#4B5563]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.9 14.32a7 7 0 111.414-1.414l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387zM14 9a5 5 0 11-10 0 5 5 0 0110 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <input
                    id="modelSearch"
                    className="h-12 w-full rounded-xl border border-[#262B36] bg-[#0F1115] px-11 text-sm text-[#E6E8EC] outline-none ring-0 transition-colors placeholder:text-[#4B5563] focus:border-[#5B8CFF]"
                    placeholder="Škoda Octavia 2019 2.0 TDI"
                  />
                  <button className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-[#5B8CFF] px-3 py-1.5 text-xs font-medium text-white shadow-[0_10px_30px_rgba(91,140,255,0.55)] transition hover:bg-[#729dff]">
                    <span>Analyzovat trh</span>
                    <span className="text-[10px] opacity-80">↵</span>
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {["Škoda Octavia", "VW Golf", "BMW 3", "Audi A4"].map(
                    (chip) => (
                      <button
                        key={chip}
                        className="rounded-full border border-[#262B36] bg-[#141720] px-3 py-1 text-xs font-medium text-[#9CA3AF] transition hover:-translate-y-0.5 hover:border-[#5B8CFF]/70 hover:text-[#E6E8EC]"
                      >
                        {chip}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
                <div className="group rounded-2xl border border-[#262B36] bg-[#171A21] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5B8CFF]/70">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                        Live market price
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        Okamžitý odhad pro český trh
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[11px] font-medium text-[#9CA3AF]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                      Stable market
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items	end justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[32px] font-semibold tracking-tight text-[#E6E8EC] sm:text-[40px]">
                          {displayedPrice.toLocaleString("cs-CZ")} Kč
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#9CA3AF]">
                        Fair range{" "}
                        <span className="font-medium text-[#E6E8EC]">
                          344 000 — 379 000 Kč
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1 text-right text-xs">
                      <p className="text-[11px] text-[#6B7280]">
                        Na základě 2 431 inzerátů
                      </p>
                      <p className="inline-flex items-center justify-end gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[11px] text-[#9CA3AF]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                        Data quality A
                      </p>
                    </div>
                  </div>
                </div>

                <div className="group rounded-2xl border border-[#262B36] bg-[#171A21] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5B8CFF]/70">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Price trend
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p
                        className={`text-sm font-medium ${
                          trendSixMonths.isPositive
                            ? "text-[#22C55E]"
                            : "text-[#F97373]"
                        }`}
                      >
                        {trendSixMonths.label}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        Vyhlazený medián z posledních 12 měsíců.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[11px] text-[#9CA3AF]">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                          trendSixMonths.isPositive
                            ? "bg-[#052e16]/70 text-[#22C55E]"
                            : "bg-[#450a0a]/70 text-[#F97373]"
                        }`}
                      >
                        {trendSixMonths.isPositive ? "↑" : "↓"}
                      </span>
                      <span>vs. před 6 měsíci</span>
                    </div>
                  </div>
                  <div className="mt-4 h-16 rounded-xl bg-gradient-to-r from-[#14532d]/40 via-[#0f172a]/40 to-[#7f1d1d]/40 opacity-80" />
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#262B36] bg-[#141720] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5B8CFF]/70 sm:p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                Market snapshot
              </p>
              <dl className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <dt className="text-[#9CA3AF]">Median price</dt>
                  <dd className="text-sm font-semibold text-[#E6E8EC]">
                    359 000 Kč
                  </dd>
                  <p className="inline-flex items-center gap-1 rounded-full bg-[#052e16]/60 px-2 py-0.5 text-[10px] text-[#22C55E]">
                    <span className="text-[11px]">▲</span> +1.2% m/m
                  </p>
                </div>
                <div className="space-y-1">
                  <dt className="text-[#9CA3AF]">Average price</dt>
                  <dd className="text-sm font-semibold text-[#E6E8EC]">
                    372 800 Kč
                  </dd>
                  <p className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2 py-0.5 text-[10px] text-[#9CA3AF]">
                    55% in fair range
                  </p>
                </div>
                <div className="space-y-1">
                  <dt className="text-[#9CA3AF]">Listings analyzed</dt>
                  <dd className="text-sm font-semibold text-[#E6E8EC]">
                    2 431
                  </dd>
                  <p className="inline-flex items-center gap-1 rounded-full bg-[#052e16]/60 px-2 py-0.5 text-[10px] text-[#22C55E]">
                    <span className="text-[11px]">●</span> 92% real listings
                  </p>
                </div>
                <div className="space-y-1">
                  <dt className="text-[#9CA3AF]">Median mileage</dt>
                  <dd className="text-sm font-semibold text-[#E6E8EC]">
                    142 000 km
                  </dd>
                  <p className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2 py-0.5 text-[10px] text-[#9CA3AF]">
                    typicky 7–11 let stáří
                  </p>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)]">
        <div className="group rounded-2xl border border-[#262B36] bg-[#171A21] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5B8CFF]/70 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                Price distribution
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Rozdělení inzerovaných cen do tří pásem.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[11px] text-[#9CA3AF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5B8CFF]" />
              <span>Horizontální distribuce</span>
            </div>
          </div>
          <SafeResponsiveChart className="mt-4 h-40 min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionChartData}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="#1F2933"
                  strokeDasharray="3 3"
                />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis type="category" dataKey="bucket" hide width={0} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const entry = payload[0].payload as PriceDistributionPoint
                    return (
                      <div className="rounded-xl border border-[#262B36] bg-[#111827] px-3 py-2 text-xs text-[#E6E8EC] shadow-xl">
                        <p className="text-[11px] font-medium text-[#9CA3AF]">
                          {entry.segment} segment
                        </p>
                        <p className="mt-1">
                          Median price:{" "}
                          <span className="font-semibold">
                            359 000 Kč
                          </span>
                        </p>
                        <p className="text-[11px] text-[#9CA3AF]">
                          Listings analyzed: 2 431
                        </p>
                      </div>
                    )
                  }}
                />
                {distributionChartData.map((entry) => (
                  <Bar
                    key={entry.segment}
                    dataKey="value"
                    stackId="price"
                    fill={entry.color}
                    radius={
                      entry.segment === "Cheap"
                        ? [999, 0, 0, 999]
                        : entry.segment === "Overpriced"
                          ? [0, 999, 999, 0]
                          : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </SafeResponsiveChart>
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#9CA3AF]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <span>Cheap</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#5B8CFF]" />
                <span>Fair price</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F97373]" />
                <span>Overpriced</span>
              </div>
            </div>
            <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[10px]">
              Medián zvýrazněn v trendu
            </span>
          </div>
        </div>

        <div className="group rounded-2xl border border-[#262B36] bg-[#171A21] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5B8CFF]/70 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                12M price trend
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Vyhlazená křivka mediánu za posledních 12 měsíců.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${
                trendSixMonths.isPositive
                  ? "bg-[#052e16]/60 text-[#22C55E]"
                  : "bg-[#111827] text-[#9CA3AF]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  trendSixMonths.isPositive ? "bg-[#22C55E]" : "bg-[#9CA3AF]"
                }`}
              />
              <span>{trendSixMonths.label}</span>
            </div>
          </div>
          <SafeResponsiveChart className="mt-4 h-56 min-h-[224px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={mockTrendData}
                margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B8CFF" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#5B8CFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#1F2933"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tickFormatter={(value: number) =>
                    `${Math.round(value / 1000)}k`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    borderRadius: 12,
                    border: "1px solid #262B36",
                    padding: "8px 10px",
                  }}
                  labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                  formatter={(value) => [
                    `${Number(value ?? 0).toLocaleString("cs-CZ")} Kč`,
                    "Median",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#5B8CFF"
                  strokeWidth={2}
                  fill="url(#trendArea)"
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </SafeResponsiveChart>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[#262B36] bg-[#171A21] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.9)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
              How we calculate real market price
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Transparentní pipeline z reálných inzerátů do robustních statistik.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[11px] text-[#9CA3AF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5B8CFF]" />
            <span>Data only · žádný marketing</span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: 1,
              title: "We collect thousands of listings",
              body: "Skenujeme české inzertní portály a sbíráme syrová data o cenách, výbavách a nájezdu.",
            },
            {
              step: 2,
              title: "We remove outliers and fake prices",
              body: "Filtrujeme nesmyslné hodnoty, duplicitní inzeráty a podezřelé vzory chování.",
            },
            {
              step: 3,
              title: "We compute robust statistics",
              body: "Medián, p25–p75, vážené průměry a časové řady pro jednotlivé modely.",
            },
            {
              step: 4,
              title: "We generate real market price",
              body: "Výstupem je realistické tržní pásmo, které můžete použít při nákupu i prodeji.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group rounded-2xl border border-[#262B36] bg-[#111827] p-4 text-xs text-[#9CA3AF] shadow-[0_14px_36px_rgba(0,0,0,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5B8CFF]/70"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B8CFF]/20 to-[#111827] text-[11px] font-semibold text-[#5B8CFF]">
                  {item.step}
                </div>
                <span className="text-[10px] uppercase tracking-[0.16em] text-[#4B5563]">
                  Step {item.step}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[#E6E8EC]">
                {item.title}
              </h3>
              <p className="mt-2 text-xs text-[#9CA3AF]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}


