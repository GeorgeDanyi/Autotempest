"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  Car,
  ChevronDown,
  ChevronRight,
  Database,
  Gauge,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { ComboBox, Select } from "@/components/filters";
import { GradientButton } from "@/components/price-trends/GradientButton";
import { GlassCard } from "@/components/price-trends/GlassCard";
import { PriceTrendChartCard } from "@/components/analyze/PriceTrendChartCard";
import { PriceDistributionCard } from "@/components/analyze/PriceDistributionCard";
import { MileageScatterCard } from "@/components/analyze/MileageScatterCard";
import { DealScoreCard } from "@/components/analyze/DealScoreCard";
import { MarketInsightsCard } from "@/components/analyze/MarketInsightsCard";
import { PriceRadarCard } from "@/components/analyze/PriceRadarCard";
import { MethodologySection } from "@/components/analyze/MethodologySection";
import { Container } from "@/components/layout/primitives";
import type { PriceApiResponse, SharedAnalysisResult } from "@/lib/pricing/types";
import { formatCurrencyCZK } from "@/lib/ui";
import { fromEngineKey, toEngineKey, ENGINE_OPTIONS } from "@/lib/analyze/engineKeys";
import {
  parseAnalyzeParams,
  buildAnalyzeSearchParams,
  analyzeParamsToPriceQuery,
  type AnalyzeParams,
} from "@/lib/analyze/analyzeParams";
import { validateAnalyzeRanges } from "@/lib/analyze/validateAnalyzeRanges";
import { resolveAnalyzeFilterState } from "@/lib/analyze/resolveAnalyzeFilterState";
import type { FilterOptionsResponse } from "@/app/api/analyze/filter-options/route";

function toSharedAnalysisResult(data: PriceApiResponse | null): SharedAnalysisResult | null {
  if (!data?.ok || !data.model_key) return null;
  return {
    model_key: data.model_key,
    requested_bucket: data.requested_bucket ?? "all",
    resolved_bucket: data.resolved_bucket ?? "all",
    fallback_used: data.fallback_used ?? false,
    segment_mode: data.segment_mode,
    requested_mileage_from: data.requested_mileage_from,
    requested_mileage_to: data.requested_mileage_to,
    applied_mileage_from: data.applied_mileage_from,
    applied_mileage_to: data.applied_mileage_to,
    sample_size: data.sample_size ?? null,
    confidence_score: data.confidence_score ?? null,
    confidence_label: data.confidence_label ?? null,
    data_quality_note: data.data_quality_note ?? null,
    median_price_czk: data.median_price_czk ?? null,
    p25_price_czk: data.p25_price_czk ?? null,
    p75_price_czk: data.p75_price_czk ?? null,
    min_price_czk: data.min_price_czk ?? null,
    max_price_czk: data.max_price_czk ?? null,
  };
}

const LIBOVOLNE = "Libovolně";
const YEAR_OPTIONS = [LIBOVOLNE, ...Array.from({ length: 2026 - 1995 + 1 }, (_, i) => String(2026 - i))];
const ENGINE_OPTIONS_WITH_LIBOVOLNE = [LIBOVOLNE, ...ENGINE_OPTIONS];
const MILEAGE_OPTIONS = [
  { label: LIBOVOLNE, value: "" },
  { label: "0 km", value: "0" },
  { label: "50 000 km", value: "50000" },
  { label: "100 000 km", value: "100000" },
  { label: "150 000 km", value: "150000" },
  { label: "200 000 km", value: "200000" },
  { label: "250 000 km", value: "250000" },
  { label: "300 000 km", value: "300000" },
];
const FUEL_OPTIONS = [LIBOVOLNE, "Benzín", "Nafta", "Hybrid", "Elektro", "LPG/CNG"];

function mileageLabelFromValue(value: string | null): string {
  if (!value) return LIBOVOLNE;
  const o = MILEAGE_OPTIONS.find((x) => x.value === value);
  return o?.label ?? LIBOVOLNE;
}

function engineLabelFromParam(engineKey: string | null): string | null {
  if (!engineKey) return null;
  return fromEngineKey(engineKey) ?? engineKey.replace(/_/g, " ").toUpperCase();
}

const SECTION_LABEL = "text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400";
const IS_DEV = process.env.NODE_ENV !== "production";
const DEVTOOLS_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true";

/** Pro developer diagnostiku: bucket string na čitelný tvar (rok, nájezd). */
function formatBucketReadable(bucket: string | null | undefined): string {
  if (!bucket || bucket === "all") return "all";
  const parts: string[] = [];
  const segs = bucket.split("__");
  for (const p of segs) {
    if (p.startsWith("year_") && p !== "unknown_year") {
      if (p === "year_2022_plus") parts.push("2022+");
      else {
        const m = p.match(/^year_(\d{4})_(\d{4})$/) ?? p.match(/^year_(\d{4})_plus$/);
        if (m) parts.push(m[2] ? `${m[1]}–${m[2]}` : `${m[1]}+`);
      }
    }
    if (p.startsWith("mileage_") && p !== "unknown_mileage") {
      const map: Record<string, string> = {
        mileage_0_50k: "0–50k km",
        mileage_50_100k: "50–100k km",
        mileage_100_150k: "100–150k km",
        mileage_150_200k: "150–200k km",
        mileage_200_250k: "200–250k km",
        mileage_250k_plus: "250k+ km",
      };
      parts.push(map[p] ?? p);
    }
  }
  return parts.length ? parts.join(", ") : bucket;
}

function isAbortedError(e: unknown): boolean {
  if (e instanceof Error) {
    if (e.name === "AbortError") return true;
    if (e.message && String(e.message).toLowerCase().includes("aborted")) return true;
  }
  return false;
}

function reportClientIssue(event: string, details?: Record<string, unknown>): void {
  if (IS_DEV) {
    console.warn("[analyze][issue]", event, details ?? {});
  }
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("autotempest:client-issue", {
        detail: { event, ...details, ts: Date.now() },
      }),
    );
  } catch {
    // no-op
  }
}

function toUserFacingAnalyzeError(input: string | null | undefined): string {
  const text = (input ?? "").toLowerCase();
  if (text.includes("missing env") || text.includes("supabase")) {
    return "Služba je dočasně nedostupná. Zkuste to prosím za chvíli znovu.";
  }
  if (text.includes("network") || text.includes("fetch")) {
    return "Nepodařilo se načíst data. Zkontrolujte připojení a zkuste to znovu.";
  }
  return "Nepodařilo se načíst tržní data pro tento výběr. Upravte filtry nebo to zkuste znovu.";
}

function buildValidAnalyzeParams(
  parsed: AnalyzeParams,
  filterOptions: FilterOptionsResponse | null,
): AnalyzeParams {
  const filterData = filterOptions?.ok ? filterOptions : null;
  const model = parsed.model?.trim() ?? null;
  if (!model) return parsed;

  const expectedBrand =
    filterData?.modelKeyToBrand?.[model] ??
    filterData?.modelKeyToBrand?.[model.toLowerCase()] ??
    null;
  const resolvedBrand = expectedBrand ?? parsed.brand ?? null;
  const modelInBrand =
    filterData == null
      ? true
      : resolvedBrand != null &&
        (filterData.modelsByBrand?.[resolvedBrand]?.some((m) => m.value === model) ?? false);

  return {
    ...parsed,
    brand: resolvedBrand,
    model: modelInBrand ? model : null,
  };
}

export function AnalyzePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const parsed = useMemo(
    () => parseAnalyzeParams(searchParams),
    [searchParams],
  );

  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/analyze/filter-options")
      .then((res) => res.json())
      .then((data: FilterOptionsResponse) => {
        if (!cancelled && data.ok) {
          setFilterOptions(data);
          if (IS_DEV) {
            const mkb = data.modelKeyToBrand ?? {};
            const mkl = data.modelKeyToLabel ?? {};
            const brands = data.brands ?? [];
            console.log("[AnalyzePageClient] filter-options raw response:", {
              keys: Object.keys(data),
              brandsLength: brands.length,
              brandsSample: brands.slice(0, 3),
              modelKeyToBrand_skoda_octavia: mkb["skoda_octavia"],
              modelKeyToLabel_skoda_octavia: mkl["skoda_octavia"],
              hasBrandValueSkoda: brands.some((b: { value: string }) => b.value === "skoda"),
            });
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!parsed.model) return;
    const valid = buildValidAnalyzeParams(parsed, filterOptions);
    if (valid.brand !== parsed.brand || valid.model !== parsed.model) {
      const next = buildAnalyzeSearchParams(valid, searchParams);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [parsed, pathname, router, filterOptions, searchParams]);

  const resolvedFilters = useMemo(
    () =>
      resolveAnalyzeFilterState(
        { brand: parsed.brand, model: parsed.model },
        filterOptions?.ok ? filterOptions : null
      ),
    [parsed.brand, parsed.model, filterOptions]
  );

  useEffect(() => {
    if (!IS_DEV) return;
    console.log("[AnalyzePageClient] final normalized filterOptions / resolved:", {
      brandValue: resolvedFilters.brandValue ?? "–",
      brandLabel: resolvedFilters.brandLabel ?? "–",
      modelValue: resolvedFilters.modelValue ?? "–",
      modelLabel: resolvedFilters.modelLabel ?? "–",
      brandOptionsLength: resolvedFilters.brandOptions.length,
      modelOptionsLength: resolvedFilters.modelOptions.length,
      modelKeyToBrand_skoda_octavia:
        filterOptions?.ok ? (filterOptions.modelKeyToBrand?.["skoda_octavia"] ?? "–") : "–",
      modelKeyToLabel_skoda_octavia:
        filterOptions?.ok ? (filterOptions.modelKeyToLabel?.["skoda_octavia"] ?? "–") : "–",
    });
  }, [resolvedFilters, filterOptions, pathname, searchParams]);

  const context = useMemo(
    () => ({
      modelLabel: resolvedFilters.modelLabel,
      yearLabel:
        parsed.yearFrom && parsed.yearTo
          ? `${parsed.yearFrom}–${parsed.yearTo}`
          : parsed.yearFrom ?? parsed.yearTo ?? null,
      engineLabel: engineLabelFromParam(parsed.engine),
    }),
    [parsed, resolvedFilters.modelLabel],
  );

  const current = useMemo(
    () => ({
      brand: parsed.brand,
      model: parsed.model,
      yearFrom: parsed.yearFrom,
      yearTo: parsed.yearTo,
      engineKey: parsed.engine,
      mileageFrom: parsed.mileageFrom,
      mileageTo: parsed.mileageTo,
      fuel: parsed.fuels ? parsed.fuels.split(",")[0]?.trim() ?? null : null,
    }),
    [parsed],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = { ...parsed };
      if (updates.brand !== undefined) next.brand = updates.brand;
      if (updates.model !== undefined) next.model = updates.model;
      if (updates.yearFrom !== undefined) next.yearFrom = updates.yearFrom;
      if (updates.yearTo !== undefined) next.yearTo = updates.yearTo;
      if (updates.engine !== undefined) next.engine = updates.engine;
      if (updates.mileageFrom !== undefined) next.mileageFrom = updates.mileageFrom;
      if (updates.mileageTo !== undefined) next.mileageTo = updates.mileageTo;
      if (updates.fuels !== undefined) next.fuels = updates.fuels;
      if (updates.brand !== undefined && filterOptions?.ok) {
        const newBrand = updates.brand;
        const modelsForBrand = newBrand ? filterOptions.modelsByBrand[newBrand] ?? [] : [];
        const currentModelInNewBrand = next.model && modelsForBrand.some((m) => m.value === next.model);
        if (next.model && !currentModelInNewBrand) next.model = null;
      }
      const params = buildAnalyzeSearchParams(next);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [parsed, pathname, router, filterOptions],
  );

  const currentEngineLabel = fromEngineKey(current.engineKey);
  const currentYearLabel =
    current.yearFrom && current.yearTo
      ? current.yearFrom === current.yearTo
        ? current.yearFrom
        : `${current.yearFrom}–${current.yearTo}`
      : current.yearFrom ?? current.yearTo ?? LIBOVOLNE;
  const yearSelectOptions = useMemo(() => {
    const base = [LIBOVOLNE, ...YEAR_OPTIONS.filter((x) => x !== LIBOVOLNE)];
    if (parsed.yearFrom && parsed.yearTo && parsed.yearFrom !== parsed.yearTo) {
      const range = `${parsed.yearFrom}–${parsed.yearTo}`;
      if (!base.includes(range)) base.splice(1, 0, range);
    }
    return base;
  }, [parsed.yearFrom, parsed.yearTo]);
  const currentMileageFromLabel = mileageLabelFromValue(current.mileageFrom ?? null);
  const currentMileageToLabel = mileageLabelFromValue(current.mileageTo ?? null);
  const currentFuelLabel = current.fuel ?? LIBOVOLNE;

  const paramsKey = searchParams.toString();
  const [analysis, setAnalysis] = useState<{ loading: boolean; error: string | null; data: PriceApiResponse | null }>({ loading: false, error: null, data: null });
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [ingestHealthOpen, setIngestHealthOpen] = useState(false);
  const [ingestHealth, setIngestHealth] = useState<{
    loading: boolean;
    error: string | null;
    data: {
      total_observations: number;
      unique_models: number;
      last_observation_at: string | null;
      total_price_index_rows: number;
      last_price_index_at: string | null;
      total_price_history_rows: number;
      last_history_at: string | null;
      top_models: { model_key: string; count: number }[];
      low_data_models: { model_key: string; count: number }[];
    } | null;
  }>({ loading: false, error: null, data: null });

  const [lastAnalyzeDebug, setLastAnalyzeDebug] = useState<{
    parsed: typeof parsed | null;
    query: Record<string, string> | null;
    queryString: string | null;
    errorStep: string | null;
    invalidReason?: string;
    observedYearRange?: { min: number; max: number };
    requestedYear?: number;
    requestedBrand?: string;
    expectedBrand?: string;
    requestedYearFrom?: string | number;
    requestedYearTo?: string | number;
    requestedMileageFrom?: string | number;
    requestedMileageTo?: string | number;
  }>({ parsed: null, query: null, queryString: null, errorStep: null });

  /** Sekundární fetch pro dev diagnostiku: sauto_only pro porovnání s all_sources. */
  const [sautoOnlyComparison, setSautoOnlyComparison] = useState<{
    loading: boolean;
    error: string | null;
    data: PriceApiResponse | null;
  }>({ loading: false, error: null, data: null });

  useEffect(() => {
    if (!ingestHealthOpen) return;
    const controller = new AbortController();
    setIngestHealth((p) => ({ ...p, loading: true, error: null }));
    fetch("/api/dev/ingest-health", { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { ok?: boolean; error?: string; total_observations?: number; unique_models?: number; last_observation_at?: string | null; total_price_index_rows?: number; last_price_index_at?: string | null; total_price_history_rows?: number; last_history_at?: string | null; top_models?: { model_key: string; count: number }[]; low_data_models?: { model_key: string; count: number }[] }) => {
        if (!json.ok) {
          setIngestHealth({ loading: false, error: json.error ?? "Chyba", data: null });
          return;
        }
        setIngestHealth({
          loading: false,
          error: null,
          data: {
            total_observations: json.total_observations ?? 0,
            unique_models: json.unique_models ?? 0,
            last_observation_at: json.last_observation_at ?? null,
            total_price_index_rows: json.total_price_index_rows ?? 0,
            last_price_index_at: json.last_price_index_at ?? null,
            total_price_history_rows: json.total_price_history_rows ?? 0,
            last_history_at: json.last_history_at ?? null,
            top_models: json.top_models ?? [],
            low_data_models: json.low_data_models ?? [],
          },
        });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setIngestHealth((p) => ({ ...p, loading: false, error: (e as Error).message, data: null }));
      });
    return () => controller.abort();
  }, [ingestHealthOpen]);

  useEffect(() => {
    if (!IS_DEV) return;
    const main = analysis.data;
    if (!main?.ok || !main.model_key || !lastAnalyzeDebug.query) {
      setSautoOnlyComparison((p) => (p.data || p.loading ? p : { loading: false, error: null, data: null }));
      return;
    }
    const controller = new AbortController();
    setSautoOnlyComparison((p) => ({ ...p, loading: true, error: null }));
    const params = new URLSearchParams(lastAnalyzeDebug.query);
    params.set("source_mode", "sauto_only");
    fetch(`/api/price?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: PriceApiResponse & { ok?: boolean; error?: string }) => {
        if (!controller.signal.aborted) {
          setSautoOnlyComparison({
            loading: false,
            error: json.ok ? null : (json.error ?? "Chyba"),
            data: json.ok ? (json as PriceApiResponse) : null,
          });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted && (e as Error).name !== "AbortError") {
          setSautoOnlyComparison((p) => ({ ...p, loading: false, error: (e as Error).message, data: null }));
        }
      });
    return () => controller.abort();
  }, [analysis.data, lastAnalyzeDebug.query]);

  useEffect(() => {
    if (!parsed.model) {
      setAnalysis({ loading: false, error: null, data: null });
      setLastAnalyzeDebug((prev) => ({ ...prev, parsed, query: null, queryString: null, errorStep: null }));
      return;
    }

    const controller = new AbortController();
    let step = "parse";

    async function load() {
      setAnalysis((p) => ({ ...p, loading: true, error: null }));
      setLastAnalyzeDebug((prev) => ({ ...prev, parsed, query: null, queryString: null, errorStep: null }));

      try {
        step = "parse";
        const validParams = buildValidAnalyzeParams(parsed, filterOptions);
        if (!validParams.model) {
          setAnalysis({ loading: false, error: null, data: null });
          return;
        }
        if (IS_DEV) {
          console.log("[AnalyzePageClient] load parsed & price params", {
            parsed_brand: parsed.brand,
            parsed_model: parsed.model,
            resolved_expected_brand_for_model: validParams.brand,
            final_price_query_brand: validParams.brand,
          });
        }
        if (IS_DEV) console.log("[analyze][debug] step=parse", "parsed", JSON.stringify(parsed));

        const rangeValidation = validateAnalyzeRanges({
          yearFrom: parsed.yearFrom,
          yearTo: parsed.yearTo,
          mileageFrom: parsed.mileageFrom,
          mileageTo: parsed.mileageTo,
        });
        if (!rangeValidation.ok) {
          const msg =
            rangeValidation.reason === "INVALID_YEAR_RANGE_ORDER"
              ? "Počáteční rok nemůže být vyšší než koncový rok."
              : "Počáteční nájezd nemůže být vyšší než koncový nájezd.";
          setLastAnalyzeDebug((prev) => ({
            ...prev,
            invalidReason: rangeValidation.reason,
            requestedYearFrom: parsed.yearFrom ?? undefined,
            requestedYearTo: parsed.yearTo ?? undefined,
            requestedMileageFrom: parsed.mileageFrom ?? undefined,
            requestedMileageTo: parsed.mileageTo ?? undefined,
          }));
          setAnalysis({ loading: false, error: msg, data: null });
          return;
        }

        step = "build-query";
        let query: Record<string, string>;
        try {
          query = analyzeParamsToPriceQuery(validParams);
        } catch (e) {
          if (IS_DEV) console.error("[analyze][debug] step=build-query", (e as Error).message, (e as Error).stack);
          throw e;
        }
        if (IS_DEV) console.log("[analyze][debug] step=build-query", "query", JSON.stringify(query));
        setLastAnalyzeDebug((prev) => ({ ...prev, query }));

        step = "build-params";
        const params = new URLSearchParams();
        Object.entries(query).forEach(([k, v]) => {
          if (v != null && v !== "") params.set(k, v);
        });
        const queryString = params.toString();
        if (IS_DEV) console.log("[analyze][debug] step=build-params", "queryString", queryString);
        setLastAnalyzeDebug((prev) => ({ ...prev, queryString }));

        step = "fetch";
        const url = `/api/price?${queryString}`;
        if (IS_DEV) console.log("[analyze][debug] step=fetch", "url", url);
        let res: Response;
        try {
          res = await fetch(url, { signal: controller.signal });
        } catch (e) {
          if (IS_DEV && !isAbortedError(e)) console.error("[analyze][debug] step=fetch", (e as Error).message, (e as Error).stack);
          throw e;
        }

        step = "response-parse";
        if (IS_DEV) console.log("[analyze][debug] step=response-parse", "status", res.status, "ok", res.ok);
        let responseText: string;
        try {
          responseText = await res.text();
        } catch (e) {
          if (IS_DEV && !isAbortedError(e)) console.error("[analyze][debug] step=response-parse (text)", (e as Error).message, (e as Error).stack);
          throw e;
        }
        if (IS_DEV && responseText) console.log("[analyze][debug] step=response-parse", "responseText", responseText.slice(0, 500));

        let json: PriceApiResponse & { error?: string };
        try {
          json = JSON.parse(responseText) as PriceApiResponse & { error?: string };
        } catch (e) {
          if (IS_DEV && !isAbortedError(e)) console.error("[analyze][debug] step=response-parse (json)", (e as Error).message, (e as Error).stack);
          throw e;
        }

        if (!res.ok || !json.ok) {
          reportClientIssue("price_api_non_ok", {
            status: res.status,
            hasJsonError: Boolean(json?.error),
          });
          setAnalysis({
            loading: false,
            error: toUserFacingAnalyzeError(json?.error),
            data: null,
          });
          return;
        }
        if ((json as { reason?: string }).reason === "INVALID_MODEL_YEAR_RANGE") {
          const invalidPayload = json as unknown as {
            reason?: string;
            model_key?: string;
            requested_year?: number;
            observed_min_year?: number;
            observed_max_year?: number;
          };
          setLastAnalyzeDebug((prev) => ({
            ...prev,
            invalidReason: invalidPayload.reason,
            observedYearRange:
              invalidPayload.observed_min_year != null && invalidPayload.observed_max_year != null
                ? { min: invalidPayload.observed_min_year, max: invalidPayload.observed_max_year }
                : undefined,
            requestedYear: invalidPayload.requested_year,
            requestedBrand: undefined,
            expectedBrand: undefined,
            requestedYearFrom: undefined,
            requestedYearTo: undefined,
            requestedMileageFrom: undefined,
            requestedMileageTo: undefined,
          }));
          setAnalysis({
            loading: false,
            error: "Zvolený rok neodpovídá dostupným datům pro tento model.",
            data: null,
          });
          return;
        }
        if ((json as { reason?: string }).reason === "INVALID_MODEL_BRAND_COMBINATION") {
          const invalidPayload = json as unknown as {
            reason?: string;
            model_key?: string;
            requested_brand?: string;
            expected_brand?: string;
          };
          setLastAnalyzeDebug((prev) => ({
            ...prev,
            invalidReason: invalidPayload.reason,
            requestedBrand: invalidPayload.requested_brand,
            expectedBrand: invalidPayload.expected_brand,
            observedYearRange: undefined,
            requestedYear: undefined,
            requestedYearFrom: undefined,
            requestedYearTo: undefined,
            requestedMileageFrom: undefined,
            requestedMileageTo: undefined,
          }));
          setAnalysis({
            loading: false,
            error: "Zvolený model nepatří pod vybranou značku.",
            data: null,
          });
          return;
        }
        if ((json as { reason?: string }).reason === "INVALID_YEAR_RANGE_ORDER") {
          const invalidPayload = json as unknown as {
            reason?: string;
            requested_year_from?: string | number;
            requested_year_to?: string | number;
          };
          setLastAnalyzeDebug((prev) => ({
            ...prev,
            invalidReason: invalidPayload.reason,
            requestedYearFrom: invalidPayload.requested_year_from,
            requestedYearTo: invalidPayload.requested_year_to,
            requestedMileageFrom: undefined,
            requestedMileageTo: undefined,
            observedYearRange: undefined,
            requestedYear: undefined,
            requestedBrand: undefined,
            expectedBrand: undefined,
          }));
          setAnalysis({
            loading: false,
            error: "Počáteční rok nemůže být vyšší než koncový rok.",
            data: null,
          });
          return;
        }
        if ((json as { reason?: string }).reason === "INVALID_MILEAGE_RANGE_ORDER") {
          const invalidPayload = json as unknown as {
            reason?: string;
            requested_mileage_from?: string | number;
            requested_mileage_to?: string | number;
          };
          setLastAnalyzeDebug((prev) => ({
            ...prev,
            invalidReason: invalidPayload.reason,
            requestedMileageFrom: invalidPayload.requested_mileage_from,
            requestedMileageTo: invalidPayload.requested_mileage_to,
            requestedYearFrom: undefined,
            requestedYearTo: undefined,
            observedYearRange: undefined,
            requestedYear: undefined,
            requestedBrand: undefined,
            expectedBrand: undefined,
          }));
          setAnalysis({
            loading: false,
            error: "Počáteční nájezd nemůže být vyšší než koncový nájezd.",
            data: null,
          });
          return;
        }
        setLastAnalyzeDebug((prev) => ({
          ...prev,
          invalidReason: undefined,
          observedYearRange: undefined,
          requestedYear: undefined,
          requestedBrand: undefined,
          expectedBrand: undefined,
          requestedYearFrom: undefined,
          requestedYearTo: undefined,
          requestedMileageFrom: undefined,
          requestedMileageTo: undefined,
        }));
        setAnalysis({ loading: false, error: null, data: json });
      } catch (e) {
        const err = e as Error;
        if (isAbortedError(e)) {
          if (IS_DEV) console.log("[analyze][debug] request aborted (params changed)");
          return;
        }
        if (IS_DEV) console.error("[analyze][debug] step=" + step, "error", err.message, "stack", err.stack);
        reportClientIssue("price_load_failed", { step, message: err.message });
        setLastAnalyzeDebug((prev) => ({ ...prev, errorStep: step }));
        const displayError = IS_DEV
          ? `${err.message} (step: ${step})`
          : "Nepodařilo se načíst analýzu. Zkuste to prosím znovu.";
        setAnalysis((p) => ({ ...p, loading: false, error: displayError, data: p.data }));
      }
    }
    load();
    return () => controller.abort();
  }, [paramsKey, parsed, filterOptions]);

  const analysisResult = useMemo(() => toSharedAnalysisResult(analysis.data ?? null), [analysis.data]);

  const fairPrice = analysisResult?.median_price_czk ?? null;
  const p25Price = analysisResult?.p25_price_czk ?? null;
  const p75Price = analysisResult?.p75_price_czk ?? null;
  const minPrice = analysisResult?.min_price_czk ?? null;
  const maxPrice = analysisResult?.max_price_czk ?? null;
  const sampleSize = analysisResult?.sample_size ?? null;
  const confidenceScore = analysisResult?.confidence_score ?? null;
  const confidenceLabel = analysisResult?.confidence_label ?? null;
  const dataQualityNote = analysisResult?.data_quality_note ?? null;
  const heroConfidenceLabel = confidenceLabel ?? (sampleSize != null ? "–" : "–");
  const effectiveFairPrice = fairPrice ?? 359_000;
  const effectiveLowPrice = minPrice ?? (p25Price != null && fairPrice != null ? Math.max(Math.round(p25Price - (fairPrice - p25Price)), 0) : 289_000);
  const effectiveHighPrice = maxPrice ?? (p75Price != null && fairPrice != null ? Math.round(p75Price + (p75Price - fairPrice)) : 439_000);
  const marketState =
    sampleSize == null || sampleSize < 5 ? { label: "Málo dat", description: "Zatím málo inzerátů." }
    : sampleSize < 20 ? { label: "Řídký trh", description: "Méně nabídek – ceny mohou kolísat." }
    : sampleSize < 60 ? { label: "Vyvážený", description: "Nabídka i poptávka v rovnováze." }
    : { label: "Stabilní", description: "Silný a likvidní trh." };
  const trendLabel = sampleSize == null || sampleSize < 5 ? "–" : sampleSize < 20 ? "–" : sampleSize < 60 ? "–" : "–";
  const segmentTitle = context.modelLabel && context.engineLabel ? `${context.modelLabel} ${context.engineLabel}` : context.modelLabel ?? "Vyber segment";
  const secondaryFiltersParts = [
    context.yearLabel ? `Rok ${context.yearLabel}` : null,
    currentMileageFromLabel !== LIBOVOLNE || currentMileageToLabel !== LIBOVOLNE
      ? `Nájezd ${currentMileageFromLabel !== LIBOVOLNE ? `od ${currentMileageFromLabel}` : ""}${currentMileageFromLabel !== LIBOVOLNE && currentMileageToLabel !== LIBOVOLNE ? " " : ""}${currentMileageToLabel !== LIBOVOLNE ? `do ${currentMileageToLabel}` : ""}`.trim()
      : null,
    currentFuelLabel !== LIBOVOLNE ? currentFuelLabel : null,
  ].filter(Boolean);
  const secondaryFiltersLabel = secondaryFiltersParts.length > 0 ? secondaryFiltersParts.join(" · ") : "Upřesni rok, nájezd a palivo.";
  const handleResetFilters = () => updateParams({ brand: null, model: null, yearFrom: null, yearTo: null, engine: null, mileageFrom: null, mileageTo: null, fuels: null });

  const hasSegment = Boolean(current.model);
  const segmentPillParts = [
    context.modelLabel,
    context.engineLabel,
    context.yearLabel,
    currentMileageFromLabel !== LIBOVOLNE || currentMileageToLabel !== LIBOVOLNE
      ? [currentMileageFromLabel !== LIBOVOLNE ? `od ${currentMileageFromLabel}` : null, currentMileageToLabel !== LIBOVOLNE ? `do ${currentMileageToLabel}` : null].filter(Boolean).join(" ")
      : null,
    currentFuelLabel !== LIBOVOLNE ? currentFuelLabel : null,
  ].filter(Boolean);

  return (
    <div className="relative min-h-screen">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-160px] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),transparent_65%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.23),transparent_70%)] blur-[120px]" />
        <div className="absolute top-10 -left-32 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_left,_rgba(45,212,191,0.20),transparent_60%),radial-gradient(circle_at_right,_rgba(59,130,246,0.16),transparent_65%)] blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 h-72 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(125,211,252,0.15),transparent_70%)] blur-[120px]" />
      </div>

      {/* Sticky SaaS header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <Container className="py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Analýza trhu</h1>
              {hasSegment && segmentPillParts.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <Car className="h-3.5 w-3.5 text-slate-500" />
                  {segmentPillParts.join(" · ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <GradientButton type="button" variant="ghost" onClick={handleResetFilters} className="!rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50" leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>Reset</GradientButton>
              <GradientButton type="button" variant="primary" rightIcon={<Sparkles className="h-3.5 w-3.5" />} className="!rounded-lg px-4 py-2 text-xs">Uložit segment</GradientButton>
            </div>
          </div>
        </Container>
      </header>

      <Container className="pb-14">
        {/* Segment editor – filtry jsou ovládací panel, ne jen vizualizace; změna okamžitě načte analýzu */}
        <section className="pt-6 pb-2">
          <GlassCard className="p-5" noHoverEffect>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Úprava segmentu</p>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <ComboBox
                label="Značka"
                placeholder="Značka"
                value={resolvedFilters.brandValue}
                onChange={(v) => updateParams({ brand: v })}
                options={resolvedFilters.brandOptions}
                displayLabel={resolvedFilters.brandLabel}
                className="min-w-0"
              />
              <ComboBox
                label="Model"
                placeholder="Model"
                value={resolvedFilters.modelValue}
                onChange={(v) => updateParams({ model: v })}
                options={resolvedFilters.modelOptions}
                displayLabel={resolvedFilters.modelLabel}
                className="min-w-0"
              />
              <Select label="Rok" placeholder={LIBOVOLNE} value={currentYearLabel} onChange={(v) => { if (!v || v === LIBOVOLNE) updateParams({ yearFrom: null, yearTo: null }); else if (v.includes("–")) { const [a, b] = v.split("–"); if (a && b) updateParams({ yearFrom: a.trim(), yearTo: b.trim() }); } else updateParams({ yearFrom: v, yearTo: v }); }} options={yearSelectOptions} className="min-w-0" />
              <Select label="Motor" placeholder={LIBOVOLNE} value={currentEngineLabel ?? LIBOVOLNE} onChange={(v) => updateParams({ engine: v && v !== LIBOVOLNE ? toEngineKey(v) : null })} options={ENGINE_OPTIONS_WITH_LIBOVOLNE} className="min-w-0" />
              <Select label="Nájezd od" placeholder={LIBOVOLNE} value={currentMileageFromLabel} onChange={(label) => { const o = MILEAGE_OPTIONS.find((x) => x.label === label); updateParams({ mileageFrom: o?.value ?? null }); }} options={MILEAGE_OPTIONS.map((o) => o.label)} className="min-w-0" />
              <Select label="Nájezd do" placeholder={LIBOVOLNE} value={currentMileageToLabel} onChange={(label) => { const o = MILEAGE_OPTIONS.find((x) => x.label === label); updateParams({ mileageTo: o?.value ?? null }); }} options={MILEAGE_OPTIONS.map((o) => o.label)} className="min-w-0" />
              <Select label="Palivo" placeholder={LIBOVOLNE} value={currentFuelLabel} onChange={(v) => updateParams({ fuels: v && v !== LIBOVOLNE ? v : null })} options={FUEL_OPTIONS} className="min-w-0" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-[11px] text-slate-500">Můžete měnit značku, model, rok, motor, nájezd i palivo – analýza se přepočítá okamžitě.</p>
              {hasSegment && analysis.loading && (
                <div className="flex items-center gap-1.5 text-[11px] text-sky-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                  Načítám…
                </div>
              )}
              {hasSegment && analysis.error && (
                <p className="text-[11px] text-amber-600" role="alert">{analysis.error}</p>
              )}
            </div>
          </GlassCard>
        </section>

        {/* Empty state – žádný model */}
        {!hasSegment && (
          <section className="pt-10">
            <GlassCard className="flex flex-col items-center justify-center py-16 px-6 text-center" noHoverEffect>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Car className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-800">Vyberte značku a model</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">V poli výše zvolte automobil, který chcete analyzovat. Po výběru modelu se zde zobrazí férová cena, trendy a přehled trhu.</p>
            </GlassCard>
          </section>
        )}

        {/* Dashboard – pouze když je vybraný model */}
        {hasSegment && (
          <>

        {/* Hero: férová cena */}
        <section aria-label="Férová cena" className="pt-8">
          <GlassCard className="p-6 sm:p-7" noHoverEffect>
            {analysis.loading && !analysis.data ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-10 w-48 animate-pulse rounded bg-slate-200" />
                <p className="text-sm text-slate-500">Načítám analýzu…</p>
              </div>
            ) : analysis.error && !analysis.data ? (
              <div>
                <p className={SECTION_LABEL}>Chyba</p>
                <p className="mt-1 text-slate-600">{analysis.error}</p>
              </div>
            ) : (
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className={SECTION_LABEL}>
                  {analysisResult?.segment_mode === "fallback"
                    ? "Odhad ceny z nejbližšího segmentu"
                    : "Férová cena segmentu"}
                </p>
                <p className="mt-1.5 font-mono text-3xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-4xl">
                  {fairPrice != null ? formatCurrencyCZK(fairPrice) : "–"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {analysisResult?.segment_mode === "fallback"
                    ? "Výsledek je odhad z nejbližšího dostupného segmentu."
                    : "Odhad dle aktuálního trhu ojetin v ČR"}
                </p>
                {analysisResult?.segment_mode === "fallback" && (
                  <p className="mt-2 inline-block rounded border border-amber-200 bg-amber-50/80 px-2 py-1 text-[11px] font-medium text-amber-800">
                    Náhradní segment
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-5 border-l border-slate-200/70 pl-5">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400"><Gauge className="h-3 w-3" />{heroConfidenceLabel}</p>
                  <p className="mt-1 font-mono text-base font-semibold text-slate-900">{sampleSize != null ? sampleSize.toLocaleString("cs-CZ") : "–"}</p>
                  <p className="text-[11px] text-slate-500">inz.</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">P25–P75</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{p25Price != null && p75Price != null ? `${formatCurrencyCZK(p25Price)} – ${formatCurrencyCZK(p75Price)}` : "–"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Vývoj</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-slate-100/90 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800"><ArrowDownRight className="h-3 w-3" />{trendLabel}</p>
                </div>
              </div>
            </div>
            )}
          </GlassCard>
        </section>

        {/* Přehled – 3 karty přímo pod férovou cenou */}
        <section aria-label="Přehled" className="pt-10 lg:pt-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-6 lg:gap-8">
            <GlassCard className="flex items-center gap-4 p-5 sm:p-6" noHoverEffect>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-slate-600"><Activity className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className={SECTION_LABEL}>Stav trhu</p>
                <p className="mt-1 font-semibold text-slate-900 text-sm">{marketState.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{marketState.description}</p>
              </div>
            </GlassCard>
            <DealScoreCard
              modelLabel={context.modelLabel}
              yearLabel={context.yearLabel}
              engineLabel={context.engineLabel}
              dealScore={analysis.data?.deal_score ?? analysis.data?.dealScore ?? null}
              dealLabel={analysis.data?.deal_label ?? analysis.data?.dealLabel ?? null}
            />
            <GlassCard className="flex items-center gap-4 p-5 sm:p-6" noHoverEffect>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 text-slate-600"><Database className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className={SECTION_LABEL}>Kvalita dat</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">{confidenceScore != null ? `${confidenceScore} %` : "–"}</p>
                <p className="mt-0.5 text-xs text-slate-600">{confidenceLabel ?? "–"}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{sampleSize != null ? `${sampleSize.toLocaleString("cs-CZ")} inz.` : "–"}</p>
                {dataQualityNote && <p className="mt-1 text-[11px] text-slate-500">{dataQualityNote}</p>}
                {confidenceScore != null && confidenceScore < 40 && (
                  <p className="mt-2 text-[11px] text-amber-600">Výsledek je orientační – doporučujeme brát v potaz s rezervou.</p>
                )}
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Data & grafy – všechny karty z jednoho analysisResult */}
        <section className="pt-12 lg:pt-14">
          <p className={SECTION_LABEL}>Data & grafy</p>
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-8">
              <PriceTrendChartCard analysisResult={analysisResult} />
            </div>
            <div className="lg:col-span-4 flex flex-col gap-6">
              <PriceRadarCard analysisResult={analysisResult} />
              <MarketInsightsCard modelLabel={context.modelLabel} analysisResult={analysisResult} />
            </div>
          </div>
        </section>

        {/* Struktura trhu */}
        <section className="pt-12 lg:pt-14">
          <p className={SECTION_LABEL}>Struktura trhu</p>
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <PriceDistributionCard analysisResult={analysisResult} />
            <MileageScatterCard analysisResult={analysisResult} />
          </div>
        </section>

        <div className="pt-12 lg:pt-14">
          <MethodologySection />
        </div>
          </>
        )}

        {/* Developer diagnostika – pouze v development */}
        {DEVTOOLS_ENABLED && (
          <section className="mt-10 border-t border-slate-200/80 pt-6" aria-label="Developer diagnostika">
            <button
              type="button"
              onClick={() => setDevPanelOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-100/80"
            >
              {devPanelOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Developer diagnostika
            </button>
            {devPanelOpen && (
              <div className="mt-2 rounded-lg border border-slate-200/80 bg-white p-4 text-[11px]">
                {analysis.error && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                    <p className="font-medium text-amber-800">Chyba</p>
                    <p className="mt-1 font-mono text-amber-900">{analysis.error}</p>
                    {lastAnalyzeDebug.errorStep && (
                      <p className="mt-1 text-amber-700">Krok selhání: <span className="font-mono">{lastAnalyzeDebug.errorStep}</span></p>
                    )}
                  </div>
                )}
                {lastAnalyzeDebug.invalidReason === "INVALID_MODEL_YEAR_RANGE" && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                    <p className="font-medium text-amber-800">Segment odmítnut (model–rok)</p>
                    <p className="mt-1 text-amber-700">Důvod: <span className="font-mono">{lastAnalyzeDebug.invalidReason}</span></p>
                    {lastAnalyzeDebug.observedYearRange && (
                      <p className="mt-1 text-amber-700">
                        Observed model year range: <span className="font-mono">{lastAnalyzeDebug.observedYearRange.min} – {lastAnalyzeDebug.observedYearRange.max}</span>
                      </p>
                    )}
                    {lastAnalyzeDebug.requestedYear != null && (
                      <p className="mt-1 text-amber-700">
                        Requested year: <span className="font-mono">{lastAnalyzeDebug.requestedYear}</span>
                      </p>
                    )}
                  </div>
                )}
                {lastAnalyzeDebug.invalidReason === "INVALID_MODEL_BRAND_COMBINATION" && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                    <p className="font-medium text-amber-800">Segment odmítnut (značka–model)</p>
                    <p className="mt-1 text-amber-700">Důvod: <span className="font-mono">{lastAnalyzeDebug.invalidReason}</span></p>
                    {lastAnalyzeDebug.requestedBrand != null && (
                      <p className="mt-1 text-amber-700">
                        Requested brand: <span className="font-mono">{lastAnalyzeDebug.requestedBrand}</span>
                      </p>
                    )}
                    {lastAnalyzeDebug.expectedBrand != null && (
                      <p className="mt-1 text-amber-700">
                        Expected brand: <span className="font-mono">{lastAnalyzeDebug.expectedBrand}</span>
                      </p>
                    )}
                  </div>
                )}
                {lastAnalyzeDebug.invalidReason === "INVALID_YEAR_RANGE_ORDER" && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                    <p className="font-medium text-amber-800">Segment odmítnut (rok od–do)</p>
                    <p className="mt-1 text-amber-700">Důvod: <span className="font-mono">{lastAnalyzeDebug.invalidReason}</span></p>
                    {lastAnalyzeDebug.requestedYearFrom != null && (
                      <p className="mt-1 text-amber-700">
                        Requested year from: <span className="font-mono">{String(lastAnalyzeDebug.requestedYearFrom)}</span>
                      </p>
                    )}
                    {lastAnalyzeDebug.requestedYearTo != null && (
                      <p className="mt-1 text-amber-700">
                        Requested year to: <span className="font-mono">{String(lastAnalyzeDebug.requestedYearTo)}</span>
                      </p>
                    )}
                  </div>
                )}
                {lastAnalyzeDebug.invalidReason === "INVALID_MILEAGE_RANGE_ORDER" && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                    <p className="font-medium text-amber-800">Segment odmítnut (nájezd od–do)</p>
                    <p className="mt-1 text-amber-700">Důvod: <span className="font-mono">{lastAnalyzeDebug.invalidReason}</span></p>
                    {lastAnalyzeDebug.requestedMileageFrom != null && (
                      <p className="mt-1 text-amber-700">
                        Requested mileage from: <span className="font-mono">{String(lastAnalyzeDebug.requestedMileageFrom)}</span>
                      </p>
                    )}
                    {lastAnalyzeDebug.requestedMileageTo != null && (
                      <p className="mt-1 text-amber-700">
                        Requested mileage to: <span className="font-mono">{String(lastAnalyzeDebug.requestedMileageTo)}</span>
                      </p>
                    )}
                  </div>
                )}
                {(parsed.model || lastAnalyzeDebug.parsed?.model) && (
                  <>
                    <span className="block pt-2 font-medium text-slate-500">Normalizované vstupy (parsed z URL)</span>
                    <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                      <span className="text-slate-400">model</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).model ?? "–"}</span>
                      <span className="text-slate-400">brand</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).brand ?? "–"}</span>
                      <span className="text-slate-400">yearFrom</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).yearFrom ?? "–"}</span>
                      <span className="text-slate-400">yearTo</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).yearTo ?? "–"}</span>
                      <span className="text-slate-400">mileageFrom</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).mileageFrom ?? "–"}</span>
                      <span className="text-slate-400">mileageTo</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).mileageTo ?? "–"}</span>
                      <span className="text-slate-400">engine</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).engine ?? "–"}</span>
                      <span className="text-slate-400">fuels</span>
                      <span className="font-mono text-slate-700">{(lastAnalyzeDebug.parsed ?? parsed).fuels ?? "–"}</span>
                    </div>
                    <span className="mt-4 block font-medium text-slate-500">Resolved (pro UI – značka odvozená z modelu)</span>
                    <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                      <span className="text-slate-400">brandValue</span>
                      <span className="font-mono text-slate-700">{resolvedFilters.brandValue ?? "–"}</span>
                      <span className="text-slate-400">brandLabel</span>
                      <span className="font-mono text-slate-700">{resolvedFilters.brandLabel ?? "–"}</span>
                      <span className="text-slate-400">modelValue</span>
                      <span className="font-mono text-slate-700">{resolvedFilters.modelValue ?? "–"}</span>
                      <span className="text-slate-400">modelLabel</span>
                      <span className="font-mono text-slate-700">{resolvedFilters.modelLabel ?? "–"}</span>
                      <span className="text-slate-400">brandOptions.length</span>
                      <span className="font-mono text-slate-700">{resolvedFilters.brandOptions.length}</span>
                      <span className="text-slate-400">modelOptions.length</span>
                      <span className="font-mono text-slate-700">{resolvedFilters.modelOptions.length}</span>
                    </div>
                  </>
                )}
                {lastAnalyzeDebug.query && (
                  <>
                    <span className="mt-4 block font-medium text-slate-500">Built query (poslední request)</span>
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 font-mono text-[10px] text-slate-800">
                      {JSON.stringify(lastAnalyzeDebug.query, null, 2)}
                    </pre>
                  </>
                )}
                {lastAnalyzeDebug.queryString != null && (
                  <p className="mt-2 text-slate-500">
                      <span className="font-medium">Query string:</span>{" "}
                      <span className="font-mono break-all text-slate-700">{lastAnalyzeDebug.queryString || "(prázdný)"}</span>
                  </p>
                )}
                {!parsed.model && !lastAnalyzeDebug.parsed?.model && !lastAnalyzeDebug.query && (
                  <p className="text-slate-500">Diagnostická data zatím nejsou k dispozici. Vyberte model.</p>
                )}
                {analysisResult && (
                  <>
                    <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-slate-200 pt-4">
                      <span className="col-span-2 font-medium text-slate-500">Odpověď API</span>
                      <span className="text-slate-400">model_key</span>
                      <span className="font-mono text-slate-700">{analysisResult.model_key}</span>
                      <span className="text-slate-400">requested_bucket</span>
                      <span className="font-mono text-slate-700 break-all">{analysisResult.requested_bucket}</span>
                      <span className="text-slate-400">requested_bucket (čitelně)</span>
                      <span className="text-slate-600">{formatBucketReadable(analysisResult.requested_bucket)}</span>
                      <span className="text-slate-400">resolved_bucket</span>
                      <span className="font-mono text-slate-700 break-all">{analysisResult.resolved_bucket}</span>
                      <span className="text-slate-400">resolved_bucket (čitelně)</span>
                      <span className="text-slate-600">{formatBucketReadable(analysisResult.resolved_bucket)}</span>
                      <span className="text-slate-400">sample_size</span>
                      <span className="font-mono text-slate-700">{analysisResult.sample_size ?? "–"}</span>
                      <span className="text-slate-400">median_price_czk</span>
                      <span className="font-mono text-slate-700">{analysisResult.median_price_czk ?? "–"}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-slate-200 pt-4">
                      <span className="col-span-2 font-medium text-slate-500">Zdrojový rozpad vzorku</span>
                      <span className="text-slate-400">total sample size</span>
                      <span className="font-mono text-slate-700">{(analysis.data as { sample_size_total?: number | null })?.sample_size_total ?? analysisResult.sample_size ?? "–"}</span>
                      {(() => {
                        const bySource = (analysis.data as { sample_size_by_source?: { sauto: number; tipcars: number; other?: number } | null })?.sample_size_by_source;
                        const total = (analysis.data as { sample_size_total?: number | null })?.sample_size_total ?? analysisResult.sample_size;
                        const hasBreakdown = bySource != null;
                        const sum = hasBreakdown ? (bySource.sauto ?? 0) + (bySource.tipcars ?? 0) + (bySource.other ?? 0) : 0;
                        const consistent = total != null && hasBreakdown && sum === total;
                        if (!hasBreakdown || !consistent) {
                          return (
                            <>
                              <span className="text-slate-400">rozpad podle zdroje</span>
                              <span className="font-mono text-slate-500">{hasBreakdown && !consistent ? "nekonzistentní" : "nedostupné"}</span>
                            </>
                          );
                        }
                        return (
                          <>
                            <span className="text-slate-400">sample size sauto</span>
                            <span className="font-mono text-slate-700">{bySource.sauto ?? "–"}</span>
                            <span className="text-slate-400">sample size tipcars</span>
                            <span className="font-mono text-slate-700">{bySource.tipcars ?? "–"}</span>
                            {(bySource as { other?: number }).other != null && (bySource as { other?: number }).other !== 0 ? (
                              <>
                                <span className="text-slate-400">sample size other</span>
                                <span className="font-mono text-slate-700">{(bySource as { other?: number }).other}</span>
                              </>
                            ) : null}
                          </>
                        );
                      })()}
                      <span className="text-slate-400">resolved bucket</span>
                      <span className="font-mono text-slate-700 break-all">{analysisResult.resolved_bucket}</span>
                      <span className="text-slate-400">segment mode</span>
                      <span className="font-mono text-slate-700">{analysisResult.segment_mode ?? "–"}</span>
                      <span className="text-slate-400">source_mode</span>
                      <span className="font-mono text-slate-700">{(analysis.data as { source_mode?: string })?.source_mode ?? "all_sources"}</span>
                      <span className="col-span-2 mt-2 text-slate-500">Porovnat: </span>
                      <span className="col-span-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = buildAnalyzeSearchParams({ ...parsed, source_mode: "all_sources" });
                            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
                          }}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Všechny zdroje
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = buildAnalyzeSearchParams({ ...parsed, source_mode: "sauto_only" });
                            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
                          }}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Pouze Sauto
                        </button>
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-slate-200 pt-4">
                      <span className="col-span-2 font-medium text-slate-500">Porovnání zdrojů</span>
                      {sautoOnlyComparison.loading && (
                        <span className="col-span-2 text-slate-500">Načítám sauto_only…</span>
                      )}
                      {sautoOnlyComparison.error && (
                        <span className="col-span-2 text-amber-600">{sautoOnlyComparison.error}</span>
                      )}
                      {!sautoOnlyComparison.loading && !sautoOnlyComparison.error && sautoOnlyComparison.data && (() => {
                        const allData = analysis.data as PriceApiResponse | null;
                        const medianAll = allData?.median_price_czk ?? null;
                        const medianSauto = sautoOnlyComparison.data.median_price_czk ?? null;
                        const sampleAll = allData?.sample_size ?? null;
                        const sampleSauto = sautoOnlyComparison.data.sample_size ?? null;
                        const tipcarsContrib = (allData?.sample_size_by_source as { tipcars?: number } | undefined)?.tipcars ?? null;
                        const deltaCzk = medianAll != null && medianSauto != null ? medianAll - medianSauto : null;
                        const deltaPct = medianSauto != null && medianSauto !== 0 && deltaCzk != null
                          ? Math.round((deltaCzk / medianSauto) * 1000) / 10
                          : null;
                        const showWarning = deltaPct != null && Math.abs(deltaPct) > 10;
                        return (
                          <>
                            <span className="text-slate-400">median all_sources</span>
                            <span className="font-mono text-slate-700">{medianAll != null ? `${medianAll.toLocaleString("cs-CZ")} Kč` : "–"}</span>
                            <span className="text-slate-400">median sauto_only</span>
                            <span className="font-mono text-slate-700">{medianSauto != null ? `${medianSauto.toLocaleString("cs-CZ")} Kč` : "–"}</span>
                            <span className="text-slate-400">rozdíl (Kč)</span>
                            <span className="font-mono text-slate-700">{deltaCzk != null ? `${deltaCzk >= 0 ? "+" : ""}${deltaCzk.toLocaleString("cs-CZ")} Kč` : "–"}</span>
                            <span className="text-slate-400">rozdíl (%)</span>
                            <span className="font-mono text-slate-700">{deltaPct != null ? `${deltaPct >= 0 ? "+" : ""}${deltaPct} %` : "–"}</span>
                            <span className="text-slate-400">sample_size all_sources</span>
                            <span className="font-mono text-slate-700">{sampleAll ?? "–"}</span>
                            <span className="text-slate-400">sample_size sauto_only</span>
                            <span className="font-mono text-slate-700">{sampleSauto ?? "–"}</span>
                            <span className="text-slate-400">tipcars contribution</span>
                            <span className="font-mono text-slate-700">{tipcarsContrib ?? "–"}</span>
                            {showWarning && (
                              <span className="col-span-2 mt-2 rounded border border-amber-200 bg-amber-50/80 p-2 text-amber-800">
                                TipCars výrazně ovlivňuje medián – doporučeno ověřit kvalitu segmentu.
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* Source quality audit – stejná data jako Porovnání zdrojů */}
                    {!sautoOnlyComparison.loading && !sautoOnlyComparison.error && sautoOnlyComparison.data && analysis.data && (() => {
                      const allData = analysis.data as PriceApiResponse & { sample_size_by_source?: { sauto?: number; tipcars?: number } };
                      const total = allData.sample_size ?? 0;
                      const tipcars = allData.sample_size_by_source?.tipcars ?? 0;
                      const sauto = allData.sample_size_by_source?.sauto ?? 0;
                      const medianAll = allData.median_price_czk ?? null;
                      const medianSauto = sautoOnlyComparison.data.median_price_czk ?? null;
                      const deltaCzk = medianAll != null && medianSauto != null ? medianAll - medianSauto : null;
                      const deltaPct = medianSauto != null && medianSauto !== 0 && deltaCzk != null
                        ? Math.round((deltaCzk / medianSauto) * 1000) / 10
                        : null;
                      const tipcarsSharePct = total > 0 ? Math.round((tipcars / total) * 1000) / 10 : null;
                      const sautoSharePct = total > 0 ? Math.round((sauto / total) * 1000) / 10 : null;
                      const absDeltaPct = deltaPct != null ? Math.abs(deltaPct) : null;
                      const isHigh = (tipcarsSharePct != null && tipcarsSharePct > 40) || (absDeltaPct != null && absDeltaPct > 10);
                      const isMedium = (tipcarsSharePct != null && tipcarsSharePct >= 20 && tipcarsSharePct <= 40) || (absDeltaPct != null && absDeltaPct >= 5 && absDeltaPct <= 10);
                      const risk: "low" | "medium" | "high" = isHigh ? "high" : isMedium ? "medium" : "low";
                      const riskConfig = {
                        low: { label: "low risk", className: "bg-emerald-100 text-emerald-800 border-emerald-200", text: "TipCars pricing výrazně nezkresluje." },
                        medium: { label: "medium risk", className: "bg-amber-100 text-amber-800 border-amber-200", text: "TipCars má znatelný vliv na segment." },
                        high: { label: "high risk", className: "bg-red-100 text-red-800 border-red-200", text: "TipCars může významně posouvat medián – doporučen audit." },
                      };
                      const cfg = riskConfig[risk];
                      return (
                        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-slate-200 pt-4">
                          <span className="col-span-2 font-medium text-slate-500">Source quality audit</span>
                          <span className="text-slate-400">tipcars share (%)</span>
                          <span className="font-mono text-slate-700">{tipcarsSharePct != null ? `${tipcarsSharePct} %` : "–"}</span>
                          <span className="text-slate-400">sauto share (%)</span>
                          <span className="font-mono text-slate-700">{sautoSharePct != null ? `${sautoSharePct} %` : "–"}</span>
                          <span className="text-slate-400">median delta vs sauto_only (%)</span>
                          <span className="font-mono text-slate-700">{deltaPct != null ? `${deltaPct >= 0 ? "+" : ""}${deltaPct} %` : "–"}</span>
                          <span className="text-slate-400">absolute median delta (CZK)</span>
                          <span className="font-mono text-slate-700">{deltaCzk != null ? `${Math.abs(deltaCzk).toLocaleString("cs-CZ")} Kč` : "–"}</span>
                          <span className="text-slate-400">risk</span>
                          <span className="flex items-center gap-2">
                            <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>{cfg.label}</span>
                            <span className="text-slate-600">{cfg.text}</span>
                          </span>
                        </div>
                      );
                    })()}
                    <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-slate-200 pt-4">
                      <span className="col-span-2 font-medium text-slate-500">Mileage interval & segment</span>
                      <span className="text-slate-400">Requested mileage interval</span>
                      <span className="font-mono text-slate-700">
                        {analysisResult.requested_mileage_from != null || analysisResult.requested_mileage_to != null
                          ? `${analysisResult.requested_mileage_from ?? "–"} – ${analysisResult.requested_mileage_to ?? "–"} km`
                          : "–"}
                      </span>
                      <span className="text-slate-400">Applied mileage interval</span>
                      <span className="font-mono text-slate-700">
                        {analysisResult.applied_mileage_from != null || analysisResult.applied_mileage_to != null
                          ? `${analysisResult.applied_mileage_from ?? "–"} – ${analysisResult.applied_mileage_to ?? "–"} km`
                          : "–"}
                      </span>
                      <span className="text-slate-400">Segment mode</span>
                      <span className="font-mono text-slate-700">{analysisResult.segment_mode ?? "–"}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* Ingest health – pouze v development */}
        {DEVTOOLS_ENABLED && (
          <section className="mt-4 border-t border-slate-200/80 pt-4" aria-label="Ingest health">
            <button
              type="button"
              onClick={() => setIngestHealthOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-100/80"
            >
              {ingestHealthOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Ingest health
            </button>
            {ingestHealthOpen && (
              <div className="mt-2 rounded-lg border border-slate-200/80 bg-white p-4 text-[11px]">
                {ingestHealth.loading && <p className="text-slate-500">Načítám…</p>}
                {!ingestHealth.loading && ingestHealth.error && (
                  <p className="text-slate-500">{ingestHealth.error}</p>
                )}
                {!ingestHealth.loading && !ingestHealth.error && !ingestHealth.data && (
                  <p className="text-slate-500">Data o ingestu zatím nejsou k dispozici.</p>
                )}
                {!ingestHealth.loading && !ingestHealth.error && ingestHealth.data && (
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                    <span className="text-slate-400">total observations</span>
                    <span className="font-mono text-slate-700">{ingestHealth.data.total_observations.toLocaleString("cs-CZ")}</span>
                    <span className="text-slate-400">unique models</span>
                    <span className="font-mono text-slate-700">{ingestHealth.data.unique_models}</span>
                    <span className="text-slate-400">last observation import</span>
                    <span className="font-mono text-slate-700">{ingestHealth.data.last_observation_at ? new Date(ingestHealth.data.last_observation_at).toLocaleString("cs-CZ") : "–"}</span>
                    <span className="text-slate-400">total price index rows</span>
                    <span className="font-mono text-slate-700">{ingestHealth.data.total_price_index_rows.toLocaleString("cs-CZ")}</span>
                    <span className="text-slate-400">last price index rebuild</span>
                    <span className="font-mono text-slate-700">{ingestHealth.data.last_price_index_at ? new Date(ingestHealth.data.last_price_index_at).toLocaleString("cs-CZ") : "–"}</span>
                    <span className="text-slate-400">total price history rows</span>
                    <span className="font-mono text-slate-700">{ingestHealth.data.total_price_history_rows.toLocaleString("cs-CZ")}</span>
                    <span className="text-slate-400">last history write</span>
                    <span className="font-mono text-slate-700">{ingestHealth.data.last_history_at ? new Date(ingestHealth.data.last_history_at).toLocaleString("cs-CZ") : "–"}</span>
                    <span className="col-span-2 mt-2 pt-2 border-t border-slate-100 text-slate-400">Top 10 modelů (počet záznamů)</span>
                    {ingestHealth.data.top_models.length === 0 ? (
                      <span className="col-span-2 font-mono text-slate-500">–</span>
                    ) : (
                      ingestHealth.data.top_models.map((m) => (
                        <span key={m.model_key} className="col-span-2 font-mono text-slate-700">{m.model_key}: {m.count}</span>
                      ))
                    )}
                    <span className="col-span-2 mt-2 pt-2 border-t border-slate-100 text-slate-400">Modely s &lt; 5 záznamy</span>
                    {ingestHealth.data.low_data_models.length === 0 ? (
                      <span className="col-span-2 font-mono text-slate-500">–</span>
                    ) : (
                      ingestHealth.data.low_data_models.map((m) => (
                        <span key={m.model_key} className="col-span-2 font-mono text-slate-700">{m.model_key}: {m.count}</span>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </Container>
    </div>
  );
}
