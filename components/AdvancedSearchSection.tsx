"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowRight, Filter as FilterIcon, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Input } from "@/components/ui/input";
import { GradientButton } from "@/components/price-trends/GradientButton";
import {
  ComboBox,
  Select,
  MultiSelect,
  MultiComboBox,
} from "@/components/filters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { computeNegotiation } from "@/lib/pricing/negotiation";
import { computeConfidence } from "@/lib/pricing/confidence";
import { parseVehicleQuery, type ParsedVehicleQuery } from "@/lib/parser/parseVehicleQuery";
import { parsePriceFromSearchInput } from "@/lib/search/parseSearchInput";
import type { PriceApiResponse, DealApiResponse } from "@/lib/pricing/types";
import { normalizeEngineParam } from "@/lib/analyze/engineKeys";
import { buildAnalyzeSearchParams, type AnalyzeParams } from "@/lib/analyze/analyzeParams";
import { validateAnalyzeRanges } from "@/lib/analyze/validateAnalyzeRanges";
import type { FilterOptionsResponse } from "@/app/api/analyze/filter-options/route";

type AdvancedSearchFilters = {
  query: string;
  brand: string | null;
  model: string | null;
  yearFrom: string;
  yearTo: string;
  mileageFrom: string;
  mileageTo: string;
  fuels: string[];
  gearbox: string | null;
  engine: string | null;
  power: string | null;
  bodyType: string | null;
  drivetrain: string | null;
};

const FUEL_OPTIONS = [
  "Benzín",
  "Diesel",
  "Hybrid",
  "Plug-in hybrid",
  "Elektro",
  "LPG/CNG",
] as const;

const GEARBOX_OPTIONS = ["Manuální", "Automatická", "DSG", "CVT"] as const;

const ENGINE_OPTIONS = [
  "1.0 TSI",
  "1.2 TSI",
  "1.4 TSI",
  "1.5 TSI",
  "1.6 TDI",
  "2.0 TDI",
  "2.0 TSI",
  "3.0 TDI",
] as const;

const POWER_OPTIONS = [
  "Libovolně",
  "0–80 kW",
  "80–100 kW",
  "100–120 kW",
  "120–150 kW",
  "150–200 kW",
  "200+ kW",
] as const;

const BODY_TYPE_OPTIONS = [
  "Hatchback",
  "Sedan",
  "Kombi",
  "SUV",
  "Coupe",
  "Kabriolet",
  "MPV",
  "Pickup",
] as const;

const DRIVETRAIN_OPTIONS = [
  "FWD (přední pohon)",
  "RWD (zadní pohon)",
  "AWD / 4x4",
] as const;

const INITIAL_FILTERS: AdvancedSearchFilters = {
  query: "",
  brand: null,
  model: null,
  yearFrom: "",
  yearTo: "",
  mileageFrom: "",
  mileageTo: "",
  fuels: [],
  gearbox: null,
  engine: null,
  power: null,
  bodyType: null,
  drivetrain: null,
};

const YEAR_OPTIONS = [
  "Libovolně",
  ...Array.from({ length: 2026 - 1995 + 1 }, (_, i) => String(2026 - i)),
];

const MILEAGE_DROPDOWN_OPTIONS = [
  { label: "Libovolně", value: "" },
  { label: "0", value: "0" },
  { label: "50 000", value: "50000" },
  { label: "100 000", value: "100000" },
  { label: "150 000", value: "150000" },
  { label: "200 000", value: "200000" },
  { label: "250 000", value: "250000" },
  { label: "300 000", value: "300000" },
];

function formatKm(value: string) {
  if (!value) return "";
  const num = parseInt(value.replace(/\D/g, ""), 10);
  if (Number.isNaN(num)) return "";
  return `${num.toLocaleString("cs-CZ")} km`;
}

function segmentLabelFromBucket(used_bucket: string): string {
  if (!used_bucket || used_bucket === "all") return "Celý trh";
  const parts: string[] = [];
  const segs = used_bucket.split("__");
  for (const s of segs) {
    if (s.startsWith("year_")) {
      if (s === "unknown_year") parts.push("?");
      else if (s === "year_2022_plus") parts.push("2022+");
      else {
        const m = s.match(/year_(\d+)_(\d+)/);
        if (m) parts.push(`${m[1]}–${m[2]}`);
        else {
          const plus = s.match(/year_(\d+)_plus/);
          if (plus) parts.push(`${plus[1]}+`);
          else parts.push(s.replace(/^year_/, ""));
        }
      }
    } else if (s.startsWith("engine_")) {
      const key = s.replace(/^engine_/, "").replace(/_/g, " ");
      const map: Record<string, string> = {
        "2 0 tdi": "2.0 TDI",
        "1 9 tdi": "1.9 TDI",
        "1 6 tdi": "1.6 TDI",
        "2 0 tsi": "2.0 TSI",
        "1 4 tsi": "1.4 TSI",
        "1 5 tsi": "1.5 TSI",
        lpg: "LPG",
        hybrid: "Hybrid",
        ev: "EV",
        unknown: "?",
      };
      parts.push(map[key] ?? key);
    } else if (s === "mileage_0_50k") parts.push("0–50k km");
    else if (s === "mileage_50_100k") parts.push("50–100k km");
    else if (s === "mileage_100_150k") parts.push("100–150k km");
    else if (s === "mileage_150_200k") parts.push("150–200k km");
    else if (s === "mileage_200_250k") parts.push("200–250k km");
    else if (s === "mileage_250k_plus") parts.push("250k+ km");
    else parts.push(s);
  }
  return parts.join(" • ");
}

function confidenceLabel(confidence: string): string {
  const map: Record<string, string> = {
    high: "vysoká",
    medium: "střední",
    low: "nízká",
    very_low: "velmi nízká",
  };
  return map[confidence] ?? confidence;
}

function engineLabelFromKey(engine_key: string | null | undefined): string | null {
  if (!engine_key) return null;
  const map: Record<string, string> = {
    // diesel
    "1_6_tdi": "1.6 TDI",
    "1_9_tdi": "1.9 TDI",
    "2_0_tdi": "2.0 TDI",
    "2_0_tdi_4x4": "2.0 TDI 4x4",
    // petrol
    "1_0_tsi": "1.0 TSI",
    "1_2_tsi": "1.2 TSI",
    "1_4_tsi": "1.4 TSI",
    "1_5_tsi": "1.5 TSI",
    "1_8_tsi": "1.8 TSI",
    "2_0_tsi": "2.0 TSI",
    // special
    rs: "RS",
    dsg: "DSG",
    hybrid: "Hybrid",
    ev: "EV",
  };
  return map[engine_key] ?? null;
}

type AnalysisTab = "text" | "url" | "trends";

type PriceTrendPoint = {
  computed_at: string;
  median_price_czk: number | null;
  p25_price_czk?: number | null;
  p75_price_czk?: number | null;
  sample_size?: number | null;
};

type PriceTrendsResponse = {
  ok: boolean;
  model_key: string;
  history: PriceTrendPoint[];
  error?: string;
};

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isLikelyUrl(input: string): boolean {
  const t = input.trim().toLowerCase();
  if (!t) return false;
  return t.startsWith("http://") || t.startsWith("https://") || t.includes("sauto.cz");
}

function extractSautoListingId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  let candidate: string | null = null;
  try {
    const u = new URL(raw);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      if (/^\d+$/.test(last)) {
        candidate = last;
      }
    }
  } catch {
    // fall back to regex on raw string
  }

  if (!candidate) {
    const match = raw.match(/(\d{7,10})/);
    if (match) {
      candidate = match[1];
    }
  }

  return candidate;
}

function toUserFacingApiError(input: string | null | undefined): string {
  const text = (input ?? "").toLowerCase();
  if (text.includes("listing not found")) {
    return "Inzerát jsme nenašli. Zkontrolujte odkaz nebo použijte ruční filtry.";
  }
  if (text.includes("network") || text.includes("fetch")) {
    return "Nepodařilo se načíst data. Zkontrolujte připojení a zkuste to znovu.";
  }
  return "Nepodařilo se načíst výsledek. Zkuste to prosím znovu.";
}

export type AdvancedSearchSectionProps = {
  variant?: "dark" | "light";
};

export function AdvancedSearchSection({ variant = "light" }: AdvancedSearchSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isDark = variant === "dark";
  const [filters, setFilters] = useState<AdvancedSearchFilters>(INITIAL_FILTERS);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("text");
  const [queryText, setQueryText] = useState("");
  const [urlText, setUrlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultPrice, setResultPrice] = useState<PriceApiResponse | null>(null);
  const [resultDeal, setResultDeal] = useState<DealApiResponse | null>(null);
  const [lastParsed, setLastParsed] = useState<ParsedVehicleQuery | null>(null);
  const [lastRequestedBucket, setLastRequestedBucket] = useState<string>("all");
  const [lastBucketUsed, setLastBucketUsed] = useState<string>("all");
  const [compareWithAllBucket, setCompareWithAllBucket] = useState(false);
  const [resultCompareSegmented, setResultCompareSegmented] = useState<PriceApiResponse | null>(null);
  const [resultCompareAll, setResultCompareAll] = useState<PriceApiResponse | null>(null);
  const [trends, setTrends] = useState<PriceTrendPoint[] | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  const MAX_PENDING_RETRIES = 5;
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const [pending, setPending] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null);
  const [pendingFailed, setPendingFailed] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualModelKey, setManualModelKey] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analyze/filter-options")
      .then((res) => res.json())
      .then((data: FilterOptionsResponse) => {
        if (!cancelled && data.ok) setFilterOptions(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!filterOptions?.ok || !filters.brand || !filters.model) return;
    const key = filters.model.trim();
    const expectedBrand =
      filterOptions.modelKeyToBrand[key] ?? filterOptions.modelKeyToBrand[key.toLowerCase()];
    if (expectedBrand == null || expectedBrand === filters.brand) return;
    setFilters((prev) => ({ ...prev, brand: expectedBrand }));
  }, [filterOptions, filters.brand, filters.model]);

  const brandOptions = React.useMemo(
    () => (filterOptions?.ok ? filterOptions.brands : []) as Array<{ value: string; label: string }>,
    [filterOptions]
  );

  const modelOptions = React.useMemo(() => {
    if (!filters.brand || !filterOptions?.ok) return [];
    return filterOptions.modelsByBrand[filters.brand] ?? [];
  }, [filters.brand, filterOptions]);

  const setFilter = <K extends keyof AdvancedSearchFilters>(
    key: K,
    value: AdvancedSearchFilters[K],
  ) => {
    if (
      key === "yearFrom" ||
      key === "yearTo" ||
      key === "mileageFrom" ||
      key === "mileageTo"
    )
      setRangeError(null);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const fetchPrice = async (
    modelKey: string,
    bucket: string,
    priceCzk: number | null,
    extra?: { year?: number | null; mileage_km?: number | null; engine_key?: string | null },
  ): Promise<{ ok: true; data: PriceApiResponse } | { ok: false; error: string }> => {
    const params = new URLSearchParams();
    params.set("model_key", modelKey);
    params.set("bucket", bucket);
    if (priceCzk != null) params.set("price_czk", String(priceCzk));
    if (extra?.year != null && Number.isFinite(extra.year)) params.set("year", String(extra.year));
    if (extra?.mileage_km != null && Number.isFinite(extra.mileage_km)) params.set("mileage_km", String(extra.mileage_km));
    if (extra?.engine_key != null && extra.engine_key !== "") params.set("engine_key", extra.engine_key);
    const res = await fetch(`/api/price?${params.toString()}`);
    const json = (await res.json()) as PriceApiResponse & { error?: string };
    if (!res.ok || !json.ok) {
      return { ok: false, error: toUserFacingApiError(json?.error) };
    }
    return { ok: true, data: json as PriceApiResponse };
  };

  const handleNormalizeYears = () => {
    const from = parseInt(filters.yearFrom, 10);
    const to = parseInt(filters.yearTo, 10);
    if (!Number.isNaN(from) && !Number.isNaN(to) && from > to) {
      setFilters((prev) => ({
        ...prev,
        yearFrom: String(to),
        yearTo: String(from),
      }));
    }
  };

  const handleNormalizeMileage = () => {
    const from = parseInt(filters.mileageFrom.replace(/\D/g, ""), 10);
    const to = parseInt(filters.mileageTo.replace(/\D/g, ""), 10);
    if (!Number.isNaN(from) && !Number.isNaN(to) && from > to) {
      setFilters((prev) => ({
        ...prev,
        mileageFrom: String(to),
        mileageTo: String(from),
      }));
    }
  };

  const handleDealFromUrl = async (
    overrideUrl?: string,
    options?: { isRetry?: boolean; attempt?: number },
  ) => {
    const url = (overrideUrl ?? urlText).trim();
    if (!url) return;

    if (!options?.isRetry) {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setPending(false);
      setRetryCount(0);
      setNextRetryIn(null);
      setPendingFailed(false);
      setManualMode(false);
      setManualModelKey("");
      setManualPrice("");
    }

    setError(null);
    setLoading(true);
    if (!options?.isRetry) {
      setResultDeal(null);
      setResultPrice(null);
    }

    try {
      const listingId = extractSautoListingId(url);
      if (!listingId) {
        setLoading(false);
        setError(
          "Neplatný odkaz — vlož prosím URL ze sauto.cz s ID inzerátu.",
        );
        return;
      }

      const res = await fetch(
        `/api/deal?source=sauto&source_listing_id=${encodeURIComponent(
          listingId,
        )}&bucket=all`,
      );

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // ignore parse error
      }

      if (res.status === 202 && json && json.status === "pending") {
        const currentAttempt = options?.attempt ?? 0;
        const nextAttempt = currentAttempt + 1;

        if (nextAttempt > MAX_PENDING_RETRIES) {
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          setLoading(false);
          setPending(false);
          setNextRetryIn(null);
          setRetryCount(currentAttempt);
          setPendingFailed(true);
          return;
        }

        setPending(true);
        setPendingFailed(false);
        setResultDeal(null);
        setRetryCount(currentAttempt);
        setNextRetryIn(3);
        setLoading(false);

        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }
        retryTimerRef.current = setTimeout(() => {
          void handleDealFromUrl(url, { isRetry: true, attempt: nextAttempt });
        }, 3000);
        return;
      }

      if (!res.ok || !json?.ok) {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        setPending(false);
        setNextRetryIn(null);
        setPendingFailed(false);
        if (
          res.status === 404 &&
          typeof json?.error === "string" &&
          json.error.toLowerCase().includes("listing not found")
        ) {
          setError(
            "Inzerát jsme nenašli (mohl být smazán). Zkontroluj odkaz nebo zadej parametry ručně.",
          );
        } else {
          setError(toUserFacingApiError(json?.error));
        }
        setResultDeal(null);
      } else {
        const currentAttempt = options?.attempt ?? 0;
        const nextAttempt = currentAttempt + 1;
        const deal = json as DealApiResponse;
        const shouldPendingRetry =
          currentAttempt < MAX_PENDING_RETRIES &&
          (deal.market == null || deal.deal_label === "unknown");

        if (shouldPendingRetry) {
          setPending(true);
          setPendingFailed(false);
          setResultDeal(null);
          setRetryCount(currentAttempt);
          setNextRetryIn(3);
          setLoading(false);

          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
          }
          retryTimerRef.current = setTimeout(() => {
            void handleDealFromUrl(url, { isRetry: true, attempt: nextAttempt });
          }, 3000);
          return;
        }

        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        setPending(false);
        setRetryCount(0);
        setNextRetryIn(null);
        setPendingFailed(false);
        setResultDeal(deal);
      }
    } catch (e: any) {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setPending(false);
      setNextRetryIn(null);
      setPendingFailed(false);
      setError(toUserFacingApiError(e?.message));
      setResultDeal(null);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAnalyze = async () => {
    const q = filters.query.trim();
    if (!q) return;

    const analyzeParams: Partial<AnalyzeParams> = {};

    if (isLikelyUrl(q)) {
      const params = new URLSearchParams();
      params.set("url", q);
      router.push(`/analyze?${params.toString()}`);
      return;
    }

    const parsed = parseVehicleQuery(q);
    if (parsed.model_key) analyzeParams.model = parsed.model_key;
    if (parsed.year != null) {
      const y = String(parsed.year);
      analyzeParams.yearFrom = y;
      analyzeParams.yearTo = y;
    }
    if (parsed.engine_key) analyzeParams.engine = parsed.engine_key;
    if (parsed.mileage_km != null) analyzeParams.mileageTo = String(parsed.mileage_km);
    if (parsed.fuel) analyzeParams.fuels = parsed.fuel;

    analyzeParams.brand = filters.brand ?? analyzeParams.brand ?? null;
    analyzeParams.model = filters.model ?? analyzeParams.model ?? null;
    analyzeParams.yearFrom = filters.yearFrom || analyzeParams.yearFrom || null;
    analyzeParams.yearTo = filters.yearTo || analyzeParams.yearTo || null;
    analyzeParams.mileageFrom = filters.mileageFrom || analyzeParams.mileageFrom || null;
    analyzeParams.mileageTo = filters.mileageTo || analyzeParams.mileageTo || null;
    analyzeParams.fuels = filters.fuels.length ? filters.fuels.join(",") : (analyzeParams.fuels ?? null);
    analyzeParams.transmission = filters.gearbox ?? null;
    analyzeParams.engine = normalizeEngineParam(filters.engine) ?? analyzeParams.engine ?? null;

    const rangeValidation = validateAnalyzeRanges({
      yearFrom: analyzeParams.yearFrom ?? null,
      yearTo: analyzeParams.yearTo ?? null,
      mileageFrom: analyzeParams.mileageFrom ?? null,
      mileageTo: analyzeParams.mileageTo ?? null,
    });
    if (!rangeValidation.ok) {
      const msg =
        rangeValidation.reason === "INVALID_YEAR_RANGE_ORDER"
          ? "Počáteční rok nemůže být vyšší než koncový rok."
          : "Počáteční nájezd nemůže být vyšší než koncový nájezd.";
      setRangeError(msg);
      return;
    }
    setRangeError(null);
    const params = buildAnalyzeSearchParams(analyzeParams);
    params.set("q", q);
    router.push(`/analyze?${params.toString()}`);
  };

  const handleApply = () => {
    const rangeValidation = validateAnalyzeRanges({
      yearFrom: filters.yearFrom || null,
      yearTo: filters.yearTo || null,
      mileageFrom: filters.mileageFrom || null,
      mileageTo: filters.mileageTo || null,
    });
    if (!rangeValidation.ok) {
      const msg =
        rangeValidation.reason === "INVALID_YEAR_RANGE_ORDER"
          ? "Počáteční rok nemůže být vyšší než koncový rok."
          : "Počáteční nájezd nemůže být vyšší než koncový nájezd.";
      setRangeError(msg);
      return;
    }
    setRangeError(null);
    const analyzeParams: Partial<AnalyzeParams> = {
      brand: filters.brand ?? null,
      model: filters.model ?? null,
      yearFrom: filters.yearFrom || null,
      yearTo: filters.yearTo || null,
      mileageFrom: filters.mileageFrom || null,
      mileageTo: filters.mileageTo || null,
      fuels: filters.fuels.length ? filters.fuels.join(",") : null,
      transmission: filters.gearbox ?? null,
      engine: normalizeEngineParam(filters.engine),
    };
    const params = buildAnalyzeSearchParams(analyzeParams);
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.power) params.set("power", filters.power);
    if (filters.bodyType) params.set("bodyType", filters.bodyType);
    if (filters.drivetrain) params.set("drivetrain", filters.drivetrain);
    router.push(`/analyze?${params.toString()}`);
  };

  const handleReset = () => {
    setFilters(INITIAL_FILTERS);
    setModelDropdownOpen(false);
    setRangeError(null);
  };

  const effectiveModelKey =
    resultPrice?.model_key ?? resultDeal?.listing?.model_key ?? null;

  const effectiveSampleSize =
    resultPrice?.sample_size ??
    (resultDeal?.market ? resultDeal.market.sample_size ?? null : null);
  const trendsModelKey =
    resultDeal?.listing?.model_key ?? (resultPrice?.model_key ?? null);

  useEffect(() => {
    // reset trends when model key changes
    setTrends(null);
    setTrendsError(null);
    setTrendsLoading(false);
  }, [trendsModelKey]);

  const autoTextClassName = isDark ? "text-center text-[12px] text-white/50" : "text-center text-[12px] text-slate-500";
  const manualFiltersLinkClassName = isDark
    ? "text-[12px] text-white/60 hover:text-white/80"
    : "text-[12px] text-slate-500 hover:text-slate-600";

  return (
    <div className="space-y-4 text-center">
      <div className="space-y-3">
        <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] overflow-hidden">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <FilterIcon className="h-4 w-4" />
          </span>
          <Input
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuickAnalyze();
            }}
            placeholder="Popiš auto (např. Škoda Octavia 2019 2.0 TDI DSG, 150 000 km)"
            className="flex-1 border-0 bg-transparent pl-10 pr-4 py-4 text-[15px] placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none h-[56px]"
          />
          <div className="flex-shrink-0 p-2">
            <button
              type="button"
              onClick={handleQuickAnalyze}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-blue-700 transition-colors h-[40px]"
            >
              Analyzovat
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <p className={autoTextClassName}>Automaticky doplníme značku, model, rok a filtry.</p>
        <span className={autoTextClassName}>·</span>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={manualFiltersLinkClassName}
        >
          {showFilters ? "Skrýt filtry ↑" : "Upřesnit ručně ↓"}
        </button>
      </div>

      {showFilters && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
            className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
          {/* Selected summary pills — zobrazují label (značka/model z API) */}
          <div className="mt-1 min-h-[28px] flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            {filters.brand && (
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, brand: null, model: null }))
                }
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
              >
                <span>{(filterOptions?.ok ? filterOptions.brandKeyToLabel?.[filters.brand] : null) ?? filters.brand}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.model && (
              <button
                type="button"
                onClick={() => setFilter("model", null)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>{(filterOptions?.ok ? filterOptions.modelKeyToLabel?.[filters.model] : null) ?? filters.model}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.yearFrom && (
              <button
                type="button"
                onClick={() => setFilter("yearFrom", "")}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>Od {filters.yearFrom}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.yearTo && (
              <button
                type="button"
                onClick={() => setFilter("yearTo", "")}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>Do {filters.yearTo}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {(filters.mileageFrom || filters.mileageTo) && (
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    mileageFrom: "",
                    mileageTo: "",
                  }))
                }
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>
                  Nájezd:{" "}
                  {filters.mileageFrom && filters.mileageTo
                    ? `${formatKm(filters.mileageFrom)} – ${formatKm(
                        filters.mileageTo,
                      )}`
                    : filters.mileageFrom
                    ? `od ${formatKm(filters.mileageFrom)}`
                    : `do ${formatKm(filters.mileageTo)}`}
                </span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.fuels.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    fuels: prev.fuels.filter((item) => item !== f),
                  }))
                }
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
              >
                <span>{f}</span>
                <span className="text-[10px]">✕</span>
              </button>
            ))}
            {filters.gearbox && (
              <button
                type="button"
                onClick={() => setFilter("gearbox", null)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>{filters.gearbox}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.engine && (
              <button
                type="button"
                onClick={() => setFilter("engine", null)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>{filters.engine}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.power && filters.power !== "Libovolně" && (
              <button
                type="button"
                onClick={() => setFilter("power", null)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>{filters.power}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.bodyType && (
              <button
                type="button"
                onClick={() => setFilter("bodyType", null)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>{filters.bodyType}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
            {filters.drivetrain && (
              <button
                type="button"
                onClick={() => setFilter("drivetrain", null)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <span>{filters.drivetrain}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}
          </div>

          {rangeError && (
            <p className="mt-2 text-sm text-amber-600" role="alert">
              {rangeError}
            </p>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-3">
            Základní parametry
          </p>
          {/* Row 1: Značka | Model | Rok od | Rok do – stejná datasource a logika jako /analyze */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ComboBox
              label="Značka"
              placeholder={filterOptions ? "Značka" : "Načítám…"}
              value={filters.brand}
              onChange={(v) => {
                const modelsForNewBrand =
                  v && filterOptions?.ok ? filterOptions.modelsByBrand[v] ?? [] : [];
                const currentModelInNewBrand =
                  filters.model && modelsForNewBrand.some((m) => m.value === filters.model);
                setFilters((prev) => ({
                  ...prev,
                  brand: v,
                  model: currentModelInNewBrand ? prev.model : null,
                }));
                if (v) setModelDropdownOpen(true);
              }}
              options={brandOptions}
              className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
            />
            <ComboBox
              label="Model"
              placeholder={
                !filters.brand
                  ? "Nejprve zvolte značku"
                  : modelOptions.length
                  ? "Model"
                  : "Načítám…"
              }
              value={filters.model}
              onChange={(v) => setFilter("model", v)}
              options={modelOptions}
              disabled={!filters.brand}
              open={modelDropdownOpen}
              onOpenChange={setModelDropdownOpen}
              className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
            />
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">Rok výroby</p>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden h-[44px]">
                <Select
                  label=""
                  placeholder="Od"
                  value={filters.yearFrom || "Libovolně"}
                  onChange={(v) => setFilter("yearFrom", v === "Libovolně" ? "" : v ?? "")}
                  options={YEAR_OPTIONS}
                  className="flex-1 border-0 shadow-none rounded-none h-full text-[14px] space-y-0 [&>label]:sr-only [&>div>button]:h-full [&>div>button]:border-0 [&>div>button]:shadow-none [&>div>button]:rounded-none [&>div>button]:bg-transparent [&>div>button]:text-[14px]"
                />
                <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
                <Select
                  label=""
                  placeholder="Do"
                  value={filters.yearTo || "Libovolně"}
                  onChange={(v) => setFilter("yearTo", v === "Libovolně" ? "" : v ?? "")}
                  options={YEAR_OPTIONS}
                  className="flex-1 border-0 shadow-none rounded-none h-full text-[14px] space-y-0 [&>label]:sr-only [&>div>button]:h-full [&>div>button]:border-0 [&>div>button]:shadow-none [&>div>button]:rounded-none [&>div>button]:bg-transparent [&>div>button]:text-[14px]"
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mt-5 mb-3">
            Technické parametry
          </p>
              {/* Row 2: Nájezd od | Nájezd do | Palivo | Převodovka */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">Nájezd km</p>
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden h-[44px]">
                    <Select
                      label=""
                      placeholder="Od"
                      value={filters.mileageFrom ? formatKm(filters.mileageFrom) : "Libovolně"}
                      onChange={(label) => {
                        const o = MILEAGE_DROPDOWN_OPTIONS.find((x) => x.label === label);
                        setFilter("mileageFrom", o ? o.value : "");
                      }}
                      options={MILEAGE_DROPDOWN_OPTIONS.map((x) => x.label)}
                      className="flex-1 border-0 shadow-none rounded-none h-full text-[14px] space-y-0 [&>label]:sr-only [&>div>button]:h-full [&>div>button]:border-0 [&>div>button]:shadow-none [&>div>button]:rounded-none [&>div>button]:bg-transparent [&>div>button]:text-[14px]"
                    />
                    <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
                    <Select
                      label=""
                      placeholder="Do"
                      value={filters.mileageTo ? formatKm(filters.mileageTo) : "Libovolně"}
                      onChange={(label) => {
                        const o = MILEAGE_DROPDOWN_OPTIONS.find((x) => x.label === label);
                        setFilter("mileageTo", o ? o.value : "");
                      }}
                      options={MILEAGE_DROPDOWN_OPTIONS.map((x) => x.label)}
                      className="flex-1 border-0 shadow-none rounded-none h-full text-[14px] space-y-0 [&>label]:sr-only [&>div>button]:h-full [&>div>button]:border-0 [&>div>button]:shadow-none [&>div>button]:rounded-none [&>div>button]:bg-transparent [&>div>button]:text-[14px]"
                    />
                  </div>
                </div>
                <MultiSelect
                  label="Palivo"
                  placeholder="Palivo"
                  value={filters.fuels}
                  onChange={(v) => setFilter("fuels", v)}
                  options={[...FUEL_OPTIONS]}
                  className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
                />
                <Select
                  label="Převodovka"
                  placeholder="Převodovka"
                  value={filters.gearbox}
                  onChange={(v) => setFilter("gearbox", v)}
                  options={[...GEARBOX_OPTIONS]}
                  className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
                />
              </div>

              {/* Row 3: Motor | Výkon | Karoserie | Pohon */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 mt-5 mb-3">
                Detaily vozu
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ComboBox
                  label="Motor"
                  placeholder="Motor"
                  value={filters.engine}
                  onChange={(v) => setFilter("engine", v)}
                  options={[...ENGINE_OPTIONS]}
                  className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
                />
                <Select
                  label="Výkon"
                  placeholder="Výkon"
                  value={filters.power ?? "Libovolně"}
                  onChange={(v) =>
                    setFilter("power", v === "Libovolně" ? null : v ?? null)
                  }
                  options={[...POWER_OPTIONS]}
                  className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
                />
                <Select
                  label="Karoserie"
                  placeholder="Karoserie"
                  value={filters.bodyType}
                  onChange={(v) => setFilter("bodyType", v)}
                  options={[...BODY_TYPE_OPTIONS]}
                  className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
                />
                <Select
                  label="Pohon"
                  placeholder="Pohon"
                  value={filters.drivetrain}
                  onChange={(v) => setFilter("drivetrain", v)}
                  options={[...DRIVETRAIN_OPTIONS]}
                  className="rounded-xl border-slate-200 bg-white h-[44px] text-[14px] [&>label]:text-[11px] [&>label]:font-medium [&>label]:text-slate-500 [&>label]:mb-1 [&>div>button]:h-[44px] [&>div>button]:rounded-xl [&>div>button]:border-slate-200 [&>div>button]:bg-white [&>div>button]:text-[14px]"
                />
              </div>

          <div className="mt-4 flex items-center justify-between gap-2 text-[11px]">
            <button
              type="button"
              onClick={handleReset}
              className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors mr-auto"
            >
              Vymazat vše
            </button>
            <GradientButton
              variant="primary"
              className="px-4 py-1.5 text-xs"
              rightIcon={<ArrowRight className="h-3 w-3" />}
              onClick={handleApply}
            >
              Použít filtry
            </GradientButton>
          </div>
          </motion.div>
        </AnimatePresence>
      )}

    </div>
  );
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCZK(value: number | null): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateCZ(d: string): string {
  if (!d) return "–";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("cs-CZ");
}

function computePctChange(
  first: number,
  last: number,
): { pct: number; direction: "up" | "down" | "flat" } {
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return { pct: 0, direction: "flat" };
  }
  const raw = ((last - first) / first) * 100;
  let direction: "up" | "down" | "flat" = "flat";
  if (raw > 0.1) direction = "up";
  else if (raw < -0.1) direction = "down";
  const pct = parseFloat(raw.toFixed(1));
  return { pct, direction };
}

function computeVolatility(values: number[]): number {
  const filtered = values.filter((v) => Number.isFinite(v));
  if (filtered.length < 2) return 0;
  const mean = filtered.reduce((acc, v) => acc + v, 0) / filtered.length;
  if (mean === 0) return 0;
  const variance =
    filtered.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) /
    filtered.length;
  const std = Math.sqrt(variance);
  return parseFloat(((std / mean) * 100).toFixed(1));
}

function normalizePoints(history: PriceTrendPoint[]): PriceTrendPoint[] {
  return history
    .filter((p) => p.median_price_czk != null)
    .sort(
      (a, b) => Date.parse(a.computed_at) - Date.parse(b.computed_at),
    );
}

type PriceApiResponseWithMeta = PriceApiResponse & {
  used_bucket?: string;
  confidence?: "high" | "medium" | "low" | "very_low";
  engine_key?: string | null;
  used_engine_specific_bucket?: boolean;
};

function ResultCardFromPrice({ result }: { result: PriceApiResponseWithMeta }) {
  const { median_price_czk, p25_price_czk, p75_price_czk, sample_size, deal_label } = result;
  const used_bucket = result.used_bucket ?? result.bucket_used ?? result.bucket ?? "all";
  const segmentLabel = segmentLabelFromBucket(used_bucket);
  const engineLabel = engineLabelFromKey(result.engine_key ?? null);
  const apiConfidence = result.confidence;
  const computedConfidence = computeConfidence(sample_size ?? null);
  const confidenceLevel = apiConfidence ?? computedConfidence.level;
  const confidenceLabelText = apiConfidence ? confidenceLabel(apiConfidence) : computedConfidence.label;
  const isLowConfidence = confidenceLevel === "low" || confidenceLevel === "very_low";

  const negotiation =
    median_price_czk != null && p25_price_czk != null && p75_price_czk != null
      ? computeNegotiation({
          median_price_czk,
          p25_price_czk,
          p75_price_czk,
        })
      : null;

  const dealLabelText: Record<string, string> = {
    top_deal: "Top deal",
    good: "Dobrá cena",
    fair: "Férové",
    overpriced: "Nadhodnocené",
    unknown: "Neznámé",
    low_confidence: "Málo dat",
  };

  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-3 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500">
            Výsledek tržní analýzy
          </div>
          <div className="text-[11px] text-slate-500">
            Analýza trhu pro model <span className="font-semibold">{result.model_key}</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Segment trhu: {segmentLabel}
          </div>
          {engineLabel && (
            <div className="text-[11px] text-slate-500">
              Detekovaný motor: <span className="font-semibold">{engineLabel}</span>
            </div>
          )}
          <div className="font-mono text-[10px] text-slate-400">Vzorek: {sample_size ?? "—"}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {deal_label && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {dealLabelText[deal_label] ?? "Neznámé"}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              confidenceLevel === "high"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"
                : confidenceLevel === "medium"
                ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
                : "border-slate-200 bg-slate-50 text-slate-600 text-[10px]"
            }
          >
            {confidenceLabelText}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-500">Odhad férové ceny</div>
          <div className="text-sm font-semibold">
            {formatCurrency(median_price_czk)}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-500">Férové rozpětí</div>
          <div className="text-xs font-medium">
            {formatCurrency(p25_price_czk)} – {formatCurrency(p75_price_czk)}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[11px] text-slate-500">Vzorek z posledních 30 dní</div>
          <div className="text-xs font-medium">{sample_size ?? 0} inzerátů</div>
        </div>
      </div>

      {isLowConfidence && (
        <p className="mt-1 rounded-lg bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-800">
          Odhad je orientační – málo dat v segmentu. Zkuste doplnit motor (např. 2.0 TDI) nebo upravit dotaz.
        </p>
      )}
      <p className="mt-1 text-[11px] text-slate-500">
        {confidenceLevel === "low" || confidenceLevel === "very_low"
          ? "Máme zatím málo podobných aut. Výsledek ber jako orientační."
          : confidenceLevel === "medium"
          ? "Výpočet vychází z menšího vzorku trhu."
          : `Výpočet vychází z dostatečného množství podobných aut (${sample_size ?? 0} inzerátů).`}
      </p>

      {negotiation && (
        <div className="mt-1 space-y-1.5 rounded-xl bg-slate-50/70 p-2.5">
          <div className="text-[11px] font-medium text-slate-600">
            Doporučení pro vyjednávání
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-[10px] text-slate-500">Cíl nákupu</div>
              <div className="font-semibold text-emerald-700">
                {formatCurrency(negotiation.target_buy_czk)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Fér minimum</div>
              <div className="font-medium">
                {formatCurrency(negotiation.fair_low_czk)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Fér maximum</div>
              <div className="font-medium">
                {formatCurrency(negotiation.fair_high_czk)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCardFromDeal({ result }: { result: DealApiResponse }) {
  const { listing, market, negotiation, deal_label } = result;

  const dealLabelText: Record<string, string> = {
    top_deal: "Top deal",
    good: "Dobrá cena",
    fair: "Férové",
    overpriced: "Nadhodnocené",
    unknown: "Neznámé",
    low_confidence: "Málo dat",
  };

  const verdictTextMap: Record<string, string> = {
    top_deal: "Cena je výrazně pod trhem.",
    good: "Cena je pod férovým rozmezím.",
    fair: "Cena odpovídá trhu.",
    overpriced: "Cena je nad trhem.",
    low_confidence: "Zatím málo dat – ber jako orientační.",
    unknown: "Zatím málo dat – ber jako orientační.",
  };

  const badgeText = deal_label ? dealLabelText[deal_label] ?? "Neznámé" : null;
  const verdictText = deal_label ? verdictTextMap[deal_label] ?? "" : "";

  const confidence = computeConfidence(market?.sample_size ?? null);

  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-3 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500">
            Ověření cenovky z inzerátu
          </div>
          <div className="text-[11px] text-slate-600">
            {listing.brand} {listing.model} {listing.year ?? ""}
          </div>
          <div className="text-[11px] text-slate-500">
            {listing.mileage_km != null
              ? `${new Intl.NumberFormat("cs-CZ", {
                  maximumFractionDigits: 0,
                }).format(listing.mileage_km)} km`
              : "Nájezd neuveden"}
          </div>
          <div className="text-[11px] text-slate-500">
            Cena v inzerátu:{" "}
            <span className="font-medium">
              {formatCurrency(listing.price_czk)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {badgeText && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {badgeText}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              confidence.level === "high"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"
                : confidence.level === "medium"
                ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
                : "border-slate-200 bg-slate-50 text-slate-600 text-[10px]"
            }
          >
            {confidence.label}
          </Badge>
        </div>
      </div>

      {market && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-500">Odhad férové ceny</div>
            <div className="text-sm font-semibold">
              {formatCurrency(market.median_price_czk)}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-500">Férové rozpětí</div>
            <div className="text-xs font-medium">
              {formatCurrency(market.p25_price_czk)} –{" "}
              {formatCurrency(market.p75_price_czk)}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-500">Vzorek z posledních 30 dní</div>
            <div className="text-xs font-medium">
              {market.sample_size ?? 0} inzerátů
            </div>
          </div>
        </div>
      )}

      <p className="mt-1 text-[11px] text-slate-500">
        {confidence.level === "low"
          ? "Máme zatím málo podobných aut. Výsledek ber jako orientační."
          : confidence.level === "medium"
          ? "Výpočet vychází z menšího vzorku trhu."
          : `Výpočet vychází z dostatečného množství podobných aut (${market?.sample_size ?? 0} inzerátů).`}
      </p>

      {negotiation && (
        <div className="mt-1 space-y-1.5 rounded-xl bg-slate-50/70 p-2.5">
          <div className="text-[11px] font-medium text-slate-600">
            Doporučení pro vyjednávání
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="text-[10px] text-slate-500">Cíl nákupu</div>
              <div className="font-semibold text-emerald-700">
                {formatCurrency(negotiation.target_buy_czk)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Fér minimum</div>
              <div className="font-medium">
                {formatCurrency(negotiation.fair_low_czk)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Fér maximum</div>
              <div className="font-medium">
                {formatCurrency(negotiation.fair_high_czk)}
              </div>
            </div>
          </div>
        </div>
      )}
      {verdictText && (
        <p className="text-[11px] text-slate-500">{verdictText}</p>
      )}
    </div>
  );
}

function TrendsMiniCard({
  modelKey,
  points,
}: {
  modelKey: string;
  points: PriceTrendPoint[];
}) {
  const medians = points.map((p) => p.median_price_czk ?? 0);
  const first = medians[0] ?? 0;
  const last = medians[medians.length - 1] ?? 0;
  const { pct, direction } = computePctChange(first, last);
  const volatility = computeVolatility(medians);
  const latestDate = points[points.length - 1]?.computed_at ?? "";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "–";

  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-3 text-xs shadow-sm">
      <div className="space-y-0.5">
        <div className="text-[11px] font-medium text-slate-500">
          Trendy ceny (90 dní)
        </div>
        <div className="text-[11px] text-slate-500">
          Model: <span className="font-semibold">{modelKey}</span>
        </div>
      </div>

      {points.length < 2 ? (
        <p className="text-xs text-slate-500">Málo bodů pro graf.</p>
      ) : (
        <TrendsMiniChart points={points} />
      )}

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
          <div className="text-[10px] text-slate-500">Změna 90 dní</div>
          <div className="mt-1 text-xs font-semibold">
            {arrow} {pct.toFixed(1)} %
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
          <div className="text-[10px] text-slate-500">Volatilita</div>
          <div className="mt-1 text-xs font-semibold">
            {volatility.toFixed(1)} %
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
          <div className="text-[10px] text-slate-500">Aktualizováno</div>
          <div className="mt-1 text-xs font-semibold">
            {formatDateCZ(latestDate)}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">Zdroj: historická tržní data.</p>
    </div>
  );
}

function TrendsMiniChart({ points }: { points: PriceTrendPoint[] }) {
  const valid = points.filter((p) => p.median_price_czk != null);
  if (valid.length < 2) {
    return (
      <p className="text-xs text-slate-500">Málo bodů pro graf.</p>
    );
  }

  const width = 300;
  const height = 90;
  const minY = 10;
  const maxY = 80;
  const medians = valid.map((p) => p.median_price_czk as number);
  const min = Math.min(...medians);
  const max = Math.max(...medians);
  const range = max - min || 1;

  const polylinePoints = valid
    .map((p, idx) => {
      const x =
        valid.length === 1
          ? width / 2
          : (idx / (valid.length - 1)) * width;
      const norm = (p.median_price_czk as number - min) / range;
      const y = maxY - norm * (maxY - minY);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-2 w-full overflow-visible text-slate-600"
    >
      <line
        x1={0}
        y1={maxY}
        x2={width}
        y2={maxY}
        stroke="currentColor"
        strokeWidth={0.5}
        className="text-slate-300"
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        points={polylinePoints}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-500"
      />
    </svg>
  );
}

function PendingNotice({
  nextRetryIn,
  retryCount,
  maxRetries,
}: {
  nextRetryIn: number | null;
  retryCount: number;
  maxRetries: number;
}) {
  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50">
          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
        </div>
        <div className="space-y-0.5">
          <div className="font-medium text-slate-700">Ověřujeme inzerát…</div>
          <div className="text-[11px] text-slate-500">
            Trvá to obvykle 5–15 s. Doplňujeme data a spočítáme férovou cenu.
          </div>
          <div className="text-[11px] text-slate-500">
            {nextRetryIn != null
              ? `Zkoušíme znovu za ${nextRetryIn}s • pokus ${
                  retryCount + 1
                }/${maxRetries}`
              : `Zkoušíme znovu… • pokus ${retryCount + 1}/${maxRetries}`}
          </div>
        </div>
      </div>
    </div>
  );
}
