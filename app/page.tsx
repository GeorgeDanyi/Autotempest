/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { animate } from "framer-motion";
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
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Car,
  Database,
  Filter as FilterIcon,
  Gauge,
  Info,
  Sigma,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/price-trends/GlassCard";
import { GradientButton } from "@/components/price-trends/GradientButton";
import { StatPill } from "@/components/price-trends/StatPill";
import { ChartTooltip } from "@/components/price-trends/ChartTooltip";
import { RangeBar } from "@/components/price-trends/RangeBar";
import { AdvancedSearchSection } from "@/components/AdvancedSearchSection";
import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart";
import { formatCurrencyCZK } from "@/lib/ui";

const MOCK_PRIMARY_PRICE = {
  modelLabel: "Škoda Octavia 2.0 TDI 2019",
  priceCZK: 359_000,
  fairRangeCZK: [344_000, 379_000] as [number, number],
  confidence: 0.92,
  marketStatus: "Trh je stabilní",
  sampleSize: 1863,
  lastUpdated: "před 2 hodinami",
};

const MOCK_DISTRIBUTION = {
  minPrice: 289_000,
  maxPrice: 439_000,
  p25Price: 332_000,
  p75Price: 388_000,
  medianPrice: 359_000,
  cheapThreshold: 330_000,
  overpricedThreshold: 390_000,
};

type TrendPeriod = "3M" | "6M" | "12M";

const MOCK_TREND_SERIES: {
  label: string;
  monthShort: string;
  price: number;
}[] = [
  { label: "04/25", monthShort: "dub", price: 364_000 },
  { label: "03/25", monthShort: "bře", price: 362_000 },
  { label: "02/25", monthShort: "úno", price: 365_000 },
  { label: "01/25", monthShort: "led", price: 368_000 },
  { label: "12/24", monthShort: "pro", price: 371_000 },
  { label: "11/24", monthShort: "lis", price: 372_500 },
  { label: "10/24", monthShort: "říj", price: 373_800 },
  { label: "09/24", monthShort: "zář", price: 374_000 },
  { label: "08/24", monthShort: "srp", price: 371_500 },
  { label: "07/24", monthShort: "čvc", price: 369_000 },
  { label: "06/24", monthShort: "čvn", price: 367_500 },
  { label: "05/24", monthShort: "kvě", price: 371_500 },
];

const MOCK_SNAPSHOT = [
  {
    label: "Analyzovaných inzerátů",
    value: "1 863",
    helper: "Za posledních 90 dní",
    icon: <Database className="h-4 w-4" />,
    sparkline: [820, 1040, 990, 1260, 1180, 1320, 1863],
  },
  {
    label: "Medián nájezdu",
    value: "152 000 km",
    helper: "Většina aut mezi 120–185 tis. km",
    icon: <Gauge className="h-4 w-4" />,
    sparkline: [168_000, 163_000, 159_000, 155_000, 152_000, 151_000, 150_500],
  },
  {
    label: "Průměrná cena",
    value: "372 400 Kč",
    helper: "Nad férovým pásmem o +3,7 %",
    icon: <Activity className="h-4 w-4" />,
    sparkline: [382_000, 378_000, 375_000, 373_500, 372_400, 372_800, 372_600],
  },
  {
    label: "Odstraněné odlehlé hodnoty",
    value: "4,3 %",
    helper: "Extrémně levné / drahé inzeráty",
    icon: <Sparkles className="h-4 w-4" />,
    sparkline: [7.2, 6.4, 5.9, 5.1, 4.8, 4.5, 4.3],
  },
];

const MOCK_DEALS = [
  {
    id: 1,
    title: "Octavia Combi 2.0 TDI Style DSG",
    price: 324_000,
    mileage: "138 000 km",
    year: 2019,
    source: "Sauto.cz",
    deltaVsMedian: "-9,7 %",
    tag: "Nejlevnější vůči mediánu",
  },
  {
    id: 2,
    title: "Octavia 2.0 TDI Ambition",
    price: 339_000,
    mileage: "121 000 km",
    year: 2019,
    source: "TipCars",
    deltaVsMedian: "-5,6 %",
    tag: "Pod férovým pásmem",
  },
  {
    id: 3,
    title: "Octavia 2.0 TDI RS",
    price: 399_000,
    mileage: "167 000 km",
    year: 2018,
    source: "Bazoš",
    deltaVsMedian: "+6,3 %",
    tag: "Výbava / výkon",
  },
  {
    id: 4,
    title: "Octavia Combi 2.0 TDI Scout 4x4",
    price: 429_000,
    mileage: "149 000 km",
    year: 2019,
    source: "AutoScout",
    deltaVsMedian: "+13,0 %",
    tag: "Nad férovým pásmem",
  },
  {
    id: 5,
    title: "Octavia 2.0 TDI Business",
    price: 352_000,
    mileage: "158 000 km",
    year: 2019,
    source: "Sauto.cz",
    deltaVsMedian: "-1,9 %",
    tag: "Blízko mediánu",
  },
];

function useCountUp(target: number, duration = 0.8) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setValue(v),
    });

    return () => {
      controls.stop();
    };
  }, [target, duration]);

  return Math.round(value);
}

export default function HomePage() {
  const [period, setPeriod] = useState<TrendPeriod>("6M");
  const primaryPriceAnimated = useCountUp(MOCK_PRIMARY_PRICE.priceCZK, 1.1);

  const trendData = useMemo(() => {
    if (period === "3M") return MOCK_TREND_SERIES.slice(0, 3).reverse();
    if (period === "6M") return MOCK_TREND_SERIES.slice(0, 6).reverse();
    return MOCK_TREND_SERIES.slice(0, 12).reverse();
  }, [period]);

  const sixMonthDeltaPct = useMemo(() => {
    const last = MOCK_TREND_SERIES[0]?.price;
    const sixMonthsAgo = MOCK_TREND_SERIES[5]?.price;
    if (!last || !sixMonthsAgo) return -3.4;
    return ((last - sixMonthsAgo) / sixMonthsAgo) * 100;
  }, []);

  const sixMonthDeltaLabel = `${sixMonthDeltaPct.toFixed(1)} % za 6 měsíců`;

  return (
    <div className="relative space-y-10 lg:space-y-14">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-160px] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),transparent_65%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.23),transparent_70%)] blur-[120px]" />
        <div className="absolute top-10 -left-32 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_left,_rgba(45,212,191,0.20),transparent_60%),radial-gradient(circle_at_right,_rgba(59,130,246,0.16),transparent_65%)] blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 h-72 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(125,211,252,0.15),transparent_70%)] blur-[120px]" />
      </div>

      {/* Hero */}
      <section
        id="hero"
        className="relative grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center"
      >
        <div className="space-y-6">
          <Badge className="inline-flex items-center gap-2 rounded-full bg-sky-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-[0_12px_40px_rgba(59,130,246,0.32)]">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
              CZ
            </span>
            Price Trends
          </Badge>

          <div className="space-y-4">
            <h1 className="text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-4xl lg:text-5xl">
              Zjistěte reálnou cenu auta z&nbsp;českého trhu
            </h1>
            <p className="max-w-[600px] text-sm leading-[1.6] text-[#64748B] sm:text-base">
              Agregujeme tisíce aktuálních inzerátů a počítáme férovou cenu
              podle stáří, nájezdu, výbavy a stavu trhu. Bez ručního
              proklikávání desítek inzertních webů.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <GradientButton
              variant="primary"
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Zjistit cenu
            </GradientButton>
            <GradientButton
              variant="ghost"
              className="sm:px-4"
              rightIcon={<Sparkles className="h-3.5 w-3.5" />}
            >
              Podívat se na demo
            </GradientButton>
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 shadow-sm backdrop-blur">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <Car className="h-3 w-3" />
              </span>
              <span>Férová cena pro konkrétní model a výbavu</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 shadow-sm backdrop-blur">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Gauge className="h-3 w-3" />
              </span>
              <span>Robustní medián, percentily a odlehlé hodnoty</span>
            </div>
          </div>
        </div>

        {/* Hero right-side insight cluster */}
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="relative w-full max-w-[440px]">
            {/* Subtle focal glow behind main insight card */}
            <div className="pointer-events-none absolute inset-[-40px] -z-10 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),transparent_70%)] blur-[40px]" />
            <GlassCard
              className="relative z-20 p-7 shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                ease: "easeOut",
                delay: 0.1,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Real Market Price
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {MOCK_PRIMARY_PRICE.modelLabel}
                  </p>
                </div>
                <StatPill
                  label="Confidence"
                  value={`${Math.round(MOCK_PRIMARY_PRICE.confidence * 100)} %`}
                  tone="info"
                />
              </div>
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs text-slate-500">Odhadovaná férová cena</p>
                  <p className="mt-2 text-4xl font-bold tracking-[-0.02em] text-slate-900 sm:text-5xl">
                    {formatCurrencyCZK(primaryPriceAnimated)}
                  </p>
                </div>
                <div>
                  <StatPill
                    label="Férové rozpětí"
                    value={`${formatCurrencyCZK(MOCK_PRIMARY_PRICE.fairRangeCZK[0])} — ${formatCurrencyCZK(
                      MOCK_PRIMARY_PRICE.fairRangeCZK[1],
                    )}`}
                    tone="default"
                    className="mt-1 text-[11px]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-slate-700">
                    {MOCK_PRIMARY_PRICE.marketStatus}
                  </span>
                  <span>· {MOCK_PRIMARY_PRICE.sampleSize.toLocaleString("cs-CZ")} inzerátů</span>
                  <span>· Aktualizováno {MOCK_PRIMARY_PRICE.lastUpdated}</span>
                </div>
              </div>
            </GlassCard>

            {/* Apple-style glass callouts anchored to corners */}
            <div className="pointer-events-none">
              {/* Top-left callout */}
              <div className="absolute -top-8 -left-8 z-30 hidden h-11 items-center gap-2 rounded-full border border-white/70 bg-white/60 px-[14px] text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:flex">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                  <Car className="h-3 w-3" />
                </span>
                <div className="flex items-baseline gap-1.5 leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-900/55">
                    Hloubka trhu
                  </span>
                  <span className="text-[11px] font-medium text-slate-900">
                    7 zdrojů
                  </span>
                </div>
              </div>

              {/* Bottom-right callout */}
              <div className="absolute -bottom-8 -right-8 z-30 hidden h-11 items-center gap-2 rounded-full border border-white/70 bg-white/60 px-[14px] text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:flex">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <ArrowDownRight className="h-3 w-3" />
                </span>
                <div className="flex items-baseline gap-1.5 leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-900/55">
                    Spread vs medián
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700">
                    −3,4 % za 6&nbsp;měsíců
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Search & filters */}
      <section id="search" className="relative">
        <div className="lg:static sticky top-20 z-30">
          <AdvancedSearchSection />

        </div>
      </section>

      {/* Main dashboard grid */}
      <section id="dashboard" className="relative space-y-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Primary insight card */}
          <GlassCard className="lg:col-span-7 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  Real Market Price
                </p>
                <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                  Férová cena na českém trhu
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatPill
                  label="Konfidence"
                  value={`${Math.round(MOCK_PRIMARY_PRICE.confidence * 100)} %`}
                  tone="info"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Odhadovaná férová cena</p>
                <p className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                  {formatCurrencyCZK(primaryPriceAnimated)}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span>
                    Model:{" "}
                    <span className="font-medium text-slate-800">
                      {MOCK_PRIMARY_PRICE.modelLabel}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1">
                    <Gauge className="h-3 w-3 text-slate-500" />
                    Medián + robustní percentily
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl bg-gradient-to-br from-sky-50/80 via-white/70 to-emerald-50/80 p-3.5 text-xs text-slate-600 ring-1 ring-white/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Shrnutí trhu
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    <ArrowDownRight className="h-3 w-3" />
                    {sixMonthDeltaLabel}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>
                      Většina inzerátů se pohybuje v rozmezí{" "}
                      <span className="font-medium">
                        {formatCurrencyCZK(MOCK_DISTRIBUTION.p25Price)} –{" "}
                        {formatCurrencyCZK(MOCK_DISTRIBUTION.p75Price)}
                      </span>
                      .
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <span>
                      Ceny postupně klesají, ale trh zůstává{" "}
                      <span className="font-medium">likvidní</span> – dostatek
                      kvalitních inzerátů.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>
                      Odstraněno{" "}
                      <span className="font-medium">
                        {MOCK_SNAPSHOT[3].value}
                      </span>{" "}
                      extrémních cen (podezřelých inzerátů).
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </GlassCard>

          {/* Price distribution */}
          <GlassCard className="lg:col-span-5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  Rozložení cen
                </p>
                <h2 className="mt-1 text-sm font-semibold tracking-tight text-slate-900">
                  Cheap / Fair / Overpriced
                </h2>
              </div>
              <StatPill
                label="Medián"
                value={formatCurrencyCZK(MOCK_DISTRIBUTION.medianPrice)}
                tone="info"
              />
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Levné</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-sky-400" />
                  <span>Férové</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-rose-400" />
                  <span>Předražené</span>
                </div>
              </div>

              <div className="group relative">
                <RangeBar
                  minPrice={MOCK_DISTRIBUTION.minPrice}
                  maxPrice={MOCK_DISTRIBUTION.maxPrice}
                  p25Price={MOCK_DISTRIBUTION.p25Price}
                  p75Price={MOCK_DISTRIBUTION.p75Price}
                  medianPrice={MOCK_DISTRIBUTION.medianPrice}
                  className="mt-2"
                />
                <div className="pointer-events-none absolute right-0 -top-1 hidden w-52 rounded-2xl border border-slate-200 bg-white/95 p-3 text-[11px] text-slate-600 shadow-[0_18px_55px_rgba(15,23,42,0.28)] backdrop-blur-xl group-hover:block">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Detail rozložení
                  </p>
                  <p>
                    Medián:{" "}
                    <span className="font-medium">
                      {formatCurrencyCZK(MOCK_DISTRIBUTION.medianPrice)}
                    </span>
                  </p>
                  <p>
                    25.–75. percentil:{" "}
                    <span className="font-medium">
                      {formatCurrencyCZK(MOCK_DISTRIBUTION.p25Price)} –{" "}
                      {formatCurrencyCZK(MOCK_DISTRIBUTION.p75Price)}
                    </span>
                  </p>
                  <p className="mt-1">
                    Vzorků:{" "}
                    <span className="font-medium">
                      {MOCK_PRIMARY_PRICE.sampleSize.toLocaleString("cs-CZ")}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Trend chart */}
          <GlassCard className="lg:col-span-12 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  Trend cen
                </p>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
                  Vývoj mediánu za posledních 12 měsíců
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 p-1 text-[11px] text-slate-500">
                  {(["3M", "6M", "12M"] as TrendPeriod[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`
                        rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors
                        ${
                          period === p
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:bg-white/70"
                        }
                      `}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <StatPill
                  label="Změna"
                  value={sixMonthDeltaLabel}
                  tone="positive"
                />
              </div>
            </div>

            <SafeResponsiveChart className="mt-4 h-64 min-h-[256px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 12, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.35)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="monthShort"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickFormatter={(v) =>
                      `${Math.round((v as number) / 1000).toLocaleString(
                        "cs-CZ",
                      )}k`
                    }
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(148,163,184,0.4)", strokeWidth: 1 }}
                    content={(props) => (
                      <ChartTooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        {...(props as any)}
                        valueFormatter={(value) =>
                          formatCurrencyCZK(value as number)
                        }
                        labelFormatter={(label) => `Měsíc ${label}`}
                      />
                    )}
                  />
                  <defs>
                    <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="rgba(59,130,246,0.35)"
                        stopOpacity={1}
                      />
                      <stop
                        offset="100%"
                        stopColor="rgba(59,130,246,0)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="transparent"
                    fill="url(#trendArea)"
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#3B82F6"
                    strokeWidth={2.4}
                    dot={false}
                    activeDot={{
                      r: 5,
                      strokeWidth: 0,
                      fill: "#1D4ED8",
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </SafeResponsiveChart>
          </GlassCard>
        </div>

        {/* Market snapshot */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MOCK_SNAPSHOT.map((item) => (
            <GlassCard
              key={item.label}
              className="p-4 sm:p-5"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="text-lg font-semibold tracking-tight text-slate-900">
                    {item.value}
                  </p>
                  <p className="text-[11px] text-slate-500">{item.helper}</p>
                </div>
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                  {item.icon}
                </div>
              </div>
              <SafeResponsiveChart className="mt-3 h-14 min-h-[56px] text-[10px] text-slate-400">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={item.sparkline.map((v, idx) => ({
                      x: idx,
                      y: v,
                    }))}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`spark-${item.label}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="rgba(59,130,246,0.35)"
                          stopOpacity={1}
                        />
                        <stop
                          offset="100%"
                          stopColor="rgba(59,130,246,0)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="y"
                      stroke="#3B82F6"
                      strokeWidth={1.6}
                      fill={`url(#spark-${item.label})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </SafeResponsiveChart>
            </GlassCard>
          ))}
        </div>

        {/* Best deals table */}
        <GlassCard id="deals" className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
                Nejlepší nabídky teď
              </p>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
                Nejzajímavější inzeráty vzhledem k mediánu
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
              <ArrowDownRight className="h-3 w-3" />
              Sledujeme rozdíl vůči férové ceně
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(148,163,184,0.28)] bg-white/70">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50/80 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nabídka</th>
                    <th className="px-4 py-2 text-left font-medium">Cena</th>
                    <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                      Nájezd
                    </th>
                    <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">
                      Rok
                    </th>
                    <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">
                      Zdroj
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Vs medián
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {MOCK_DEALS.map((deal) => (
                    <tr
                      key={deal.id}
                      className="group cursor-pointer bg-white/40 transition-colors hover:bg-sky-50/70"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-900">
                            {deal.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {deal.source} ·{" "}
                            <span className="font-medium">
                              {deal.tag}
                            </span>
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm font-semibold text-slate-900">
                        {formatCurrencyCZK(deal.price)}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-600 hidden md:table-cell">
                        {deal.mileage}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-600 hidden sm:table-cell">
                        {deal.year}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-600 hidden sm:table-cell">
                        {deal.source}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/20">
                          <ArrowDownRight className="h-3 w-3" />
                          {deal.deltaVsMedian}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition-colors group-hover:border-sky-400/70 group-hover:text-sky-700"
                        >
                          Zobrazit
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Method section */}
      <section id="method" className="relative space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Metodika
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Jak počítáme férovou cenu
            </h2>
            <p className="max-w-2xl text-sm text-slate-600">
              Kombinujeme robustní statistiku s doménovou znalostí českého trhu.
              Transparentně, reprodukovatelně a bez magie.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Database className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  1. Sbíráme inzeráty
                </p>
                <p className="text-xs text-slate-600">
                  Stahujeme strukturovaná data z hlavních inzertních serverů,
                  normalizujeme názvy modelů a doplňujeme metadata.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <FilterIcon className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  2. Čistíme odlehlé hodnoty
                </p>
                <p className="text-xs text-slate-600">
                  Odstraníme podezřele levné a drahé inzeráty, duplicity a
                  chyby v zadání, aby výsledek nezkreslovaly extrémy.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Sigma className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  3. Počítáme robustní statistiky
                </p>
                <p className="text-xs text-slate-600">
                  Pracujeme s mediánem, percentily, vážením podle stáří a
                  nájezdu i s vývojem v čase.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  4. Vypočítáme férové pásmo
                </p>
                <p className="text-xs text-slate-600">
                  Výsledkem je férová cena a pásmo, které reflektuje aktuální
                  trh a specifika českého prostředí.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Datové zdroje (mock)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] shadow-sm ring-1 ring-slate-200">
            Sauto.cz
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] shadow-sm ring-1 ring-slate-200">
            TipCars
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] shadow-sm ring-1 ring-slate-200">
            Bazoš
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] shadow-sm ring-1 ring-slate-200">
            AutoScout
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-2 flex flex-col gap-3 border-t border-white/60 pt-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Poslední aktualizace tržních dat:{" "}
          <span className="font-medium text-slate-700">
            dnes v 10:24 (mock)
          </span>
          .
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-[11px] text-slate-500 hover:text-slate-800"
          >
            Ochrana dat
          </button>
          <button
            type="button"
            className="text-[11px] text-slate-500 hover:text-slate-800"
          >
            API &amp; export
          </button>
          <button
            type="button"
            className="text-[11px] text-slate-500 hover:text-slate-800"
          >
            Kontakt
          </button>
        </div>
      </footer>
    </div>
  );
}

