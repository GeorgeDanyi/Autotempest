"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ComboBox, MultiComboBox, MultiSelect, Select } from "@/components/filters";
import { GradientButton } from "@/components/price-trends/GradientButton";
import { fromEngineKey, toEngineKey, ENGINE_OPTIONS } from "@/lib/analyze/engineKeys";
import { parseAnalyzeParams, buildAnalyzeSearchParams } from "@/lib/analyze/analyzeParams";
import { resolveAnalyzeFilterState } from "@/lib/analyze/resolveAnalyzeFilterState";
import { validateAnalyzeRanges } from "@/lib/analyze/validateAnalyzeRanges";
import type { FilterOptionsResponse } from "@/app/api/analyze/filter-options/route";

type FiltersState = {
  brand: string | null;
  model: string | null;
  yearFrom: string;
  yearTo: string;
  mileageFrom: string;
  mileageTo: string;
  fuels: string[];
  transmission: string | null;
  engine: string | null;
  bodyType: string | null;
  drivetrain: string | null;
  trim: string | null;
};

const INITIAL_STATE: FiltersState = {
  brand: null,
  model: null,
  yearFrom: "",
  yearTo: "",
  mileageFrom: "",
  mileageTo: "",
  fuels: [],
  transmission: null,
  engine: null,
  bodyType: null,
  drivetrain: null,
  trim: null,
};

const YEAR_OPTIONS = [
  "Libovolně",
  ...Array.from({ length: 2026 - 1995 + 1 }, (_, i) => String(2026 - i)),
];

const MILEAGE_OPTIONS = [
  { label: "Libovolně", value: "" },
  { label: "0 km", value: "0" },
  { label: "50 000 km", value: "50000" },
  { label: "100 000 km", value: "100000" },
  { label: "150 000 km", value: "150000" },
  { label: "200 000 km", value: "200000" },
  { label: "250 000 km", value: "250000" },
  { label: "300 000 km", value: "300000" },
];

const FUEL_OPTIONS = ["Benzín", "Nafta", "Hybrid", "Elektro", "LPG/CNG"];

const TRANSMISSION_OPTIONS = ["Manuál", "Automat", "DSG"];

const BODY_OPTIONS = [
  "Hatchback",
  "Sedan",
  "Kombi",
  "SUV",
  "Coupe",
  "Kabriolet",
];

const DRIVETRAIN_OPTIONS = ["FWD", "RWD", "AWD / 4x4"];

const TRIM_OPTIONS = ["Ambition", "Style", "Sportline", "Scout", "RS"];

function mileageLabel(value: string): string {
  if (!value) return "Libovolně";
  const parsed = parseInt(value.replace(/\D/g, ""), 10);
  if (Number.isNaN(parsed)) return "Libovolně";
  return `${parsed.toLocaleString("cs-CZ")} km`;
}

const FUEL_LABEL_TO_API: Record<string, string> = {
  Benzín: "petrol",
  Nafta: "diesel",
  Hybrid: "hybrid",
  Elektro: "ev",
  "LPG/CNG": "lpg",
};
const FUEL_API_TO_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(FUEL_LABEL_TO_API).map(([k, v]) => [v, k]),
);

const TRANSMISSION_LABEL_TO_API: Record<string, string> = {
  Manuál: "manual",
  Automat: "automatic",
  DSG: "dsg",
};

export function AnalyzeFiltersCard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FiltersState>(INITIAL_STATE);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analyze/filter-options")
      .then((res) => res.json())
      .then((data: FilterOptionsResponse) => {
        if (!cancelled && data.ok) {
          setFilterOptions(data);
          if (process.env.NODE_ENV === "development") {
            const brands = data.brands ?? [];
            console.log("[AnalyzeFiltersCard] filter-options loaded", {
              brandsLength: brands.length,
              brandsSample: brands.slice(0, 3),
              modelKeyToBrand_skoda_octavia: data.modelKeyToBrand?.["skoda_octavia"],
            });
          }
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") console.warn("[AnalyzeFiltersCard] filter-options fetch failed", err);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const parsed = parseAnalyzeParams(searchParams);
    const params = Object.fromEntries(searchParams.entries());
    const filterData = filterOptions?.ok ? filterOptions : null;
    setFilters((prev) => {
      const modelFromUrl = parsed.model?.trim() ?? null;
      const brandFromUrl = parsed.brand?.trim() ?? null;
      const brandFromModel =
        (modelFromUrl && filterData?.modelKeyToBrand
          ? filterData.modelKeyToBrand[modelFromUrl] ?? filterData.modelKeyToBrand[modelFromUrl.toLowerCase()]
          : null);
      const brand = brandFromModel ?? brandFromUrl ?? prev.brand;
      const modelCandidate = modelFromUrl ?? parsed.model ?? prev.model;
      const modelsForBrand = brand ? filterData?.modelsByBrand?.[brand] ?? [] : [];
      const modelIsValidForBrand =
        modelCandidate != null &&
        brand != null &&
        modelsForBrand.some((m) => m.value === modelCandidate);
      const model = modelIsValidForBrand ? modelCandidate : null;

      return {
        ...prev,
        brand,
        model,
        yearFrom: parsed.yearFrom ?? prev.yearFrom,
        yearTo: parsed.yearTo ?? prev.yearTo,
        mileageFrom: parsed.mileageFrom ?? params.mileageFrom ?? prev.mileageFrom,
        mileageTo: parsed.mileageTo ?? prev.mileageTo,
        fuels: parsed.fuels
          ? parsed.fuels
              .split(",")
              .filter(Boolean)
              .map((f) => FUEL_API_TO_LABEL[f] ?? f)
          : prev.fuels,
        transmission: parsed.transmission ?? prev.transmission,
        engine: parsed.engine ?? prev.engine,
        bodyType: params.bodyType ?? prev.bodyType,
        drivetrain: params.drivetrain ?? prev.drivetrain,
        trim: params.trim ?? prev.trim,
      };
    });
  }, [searchParams, filterOptions]);

  useEffect(() => {
    const parsed = parseAnalyzeParams(searchParams);
    if (!parsed.model) return;
    const key = parsed.model.trim();
    const expectedBrand =
      (filterOptions?.ok ? filterOptions.modelKeyToBrand?.[key] : undefined) ??
      (filterOptions?.ok ? filterOptions.modelKeyToBrand?.[key.toLowerCase()] : undefined) ??
      null;
    if (!expectedBrand) return;
    if (parsed.brand !== expectedBrand) {
      const next = buildAnalyzeSearchParams({ ...parsed, brand: expectedBrand }, searchParams);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      return;
    }
    const modelInBrandSafe =
      filterOptions?.ok
        ? (filterOptions.modelsByBrand?.[expectedBrand]?.some((m) => m.value === key) ?? false)
        : false;
    if (!modelInBrandSafe) {
      const next = buildAnalyzeSearchParams({ ...parsed, model: null }, searchParams);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [searchParams, pathname, router, filterOptions]);

  const resolvedFilters = useMemo(
    () =>
      resolveAnalyzeFilterState(
        { brand: filters.brand, model: filters.model },
        filterOptions?.ok ? filterOptions : null
      ),
    [filters.brand, filters.model, filterOptions]
  );

  if (process.env.NODE_ENV === "development" && (filters.brand != null || filters.model != null)) {
    const brandMatch = resolvedFilters.brandOptions.some((o) => o.value === resolvedFilters.brandValue);
    const modelMatch = resolvedFilters.modelOptions.some((o) => o.value === resolvedFilters.modelValue);
    console.log("[AnalyzeFiltersCard] resolved state", {
      "raw filters.brand": filters.brand,
      "raw filters.model": filters.model,
      "resolvedFilters.brandValue": resolvedFilters.brandValue,
      "resolvedFilters.modelValue": resolvedFilters.modelValue,
      "resolvedFilters.brandLabel": resolvedFilters.brandLabel,
      "resolvedFilters.modelLabel": resolvedFilters.modelLabel,
      "resolvedFilters.brandOptions.length": resolvedFilters.brandOptions.length,
      "resolvedFilters.modelOptions.length": resolvedFilters.modelOptions.length,
      "brand has matching option": brandMatch,
      "model has matching option": modelMatch,
    });
  }

  const setFilter = useCallback(<K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    if (key === "yearFrom" || key === "yearTo" || key === "mileageFrom" || key === "mileageTo") setRangeError(null);
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "brand" && filterOptions?.ok) {
        const newBrand = value as string | null;
        const modelsForBrand = newBrand ? filterOptions.modelsByBrand[newBrand] ?? [] : [];
        const currentModelInNewBrand = prev.model && modelsForBrand.some((m) => m.value === prev.model);
        if (prev.model && !currentModelInNewBrand) next.model = null;
      }
      return next;
    });
  }, [filterOptions]);

  const appliedChips = useMemo(() => {
    const chips: string[] = [];
    if (resolvedFilters.brandLabel) chips.push(resolvedFilters.brandLabel);
    if (resolvedFilters.modelLabel) chips.push(resolvedFilters.modelLabel);
    if (filters.yearFrom) chips.push(`Od ${filters.yearFrom}`);
    if (filters.yearTo) chips.push(`Do ${filters.yearTo}`);
    if (filters.mileageFrom || filters.mileageTo) {
      const from = filters.mileageFrom ? mileageLabel(filters.mileageFrom) : "0 km";
      const to = filters.mileageTo ? mileageLabel(filters.mileageTo) : "∞";
      chips.push(`Nájezd ${from} – ${to}`);
    }
    if (filters.fuels.length) chips.push(filters.fuels.join(", "));
    if (filters.transmission) chips.push(filters.transmission);
    if (filters.engine) chips.push(fromEngineKey(filters.engine) ?? filters.engine);
    if (filters.bodyType) chips.push(filters.bodyType);
    if (filters.drivetrain) chips.push(filters.drivetrain);
    if (filters.trim) chips.push(filters.trim);
    return chips;
  }, [filters, resolvedFilters.brandLabel, resolvedFilters.modelLabel]);

  const handleReset = () => {
    setFilters(INITIAL_STATE);
    const params = new URLSearchParams(searchParams.toString());
    ["brand","model","yearFrom","yearTo","mileageFrom","mileageTo","fuels","transmission","engine","bodyType","drivetrain","trim"].forEach((key) => {
      params.delete(key);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
    const params = buildAnalyzeSearchParams(
      {
        brand: filters.brand,
        model: filters.model,
        yearFrom: filters.yearFrom || null,
        yearTo: filters.yearTo || null,
        mileageFrom: filters.mileageFrom || null,
        mileageTo: filters.mileageTo || null,
        fuels: filters.fuels.length
          ? filters.fuels
              .map((f) => FUEL_LABEL_TO_API[f] ?? f)
              .join(",")
          : null,
        transmission: filters.transmission
          ? TRANSMISSION_LABEL_TO_API[filters.transmission] ??
            filters.transmission
          : null,
        engine: filters.engine,
      },
      searchParams,
    );
    if (filters.bodyType) params.set("bodyType", filters.bodyType);
    else params.delete("bodyType");
    if (filters.drivetrain) params.set("drivetrain", filters.drivetrain);
    else params.delete("drivetrain");
    if (filters.trim) params.set("trim", filters.trim);
    else params.delete("trim");

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Filtry analýzy
          </p>
          <p className="text-sm text-slate-500">
            Uprav značku, model a období. Pokročilé filtry můžeš rozbalit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-[box-shadow] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            {advancedOpen ? "Skrýt pokročilé" : "Pokročilé filtry"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-[box-shadow] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            Resetovat
          </button>
          <GradientButton
            variant="primary"
            className="rounded-xl px-4 py-2 text-sm font-medium"
            onClick={handleApply}
          >
            Použít filtry
          </GradientButton>
        </div>
      </div>

      <div className="mt-4 min-h-[28px] flex flex-wrap items-center gap-2 text-sm text-slate-600">
        {appliedChips.length === 0 ? (
          <span className="text-slate-400">
            Zatím žádné aktivní filtry – použij pole níže.
          </span>
        ) : (
          appliedChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-slate-800"
            >
              {chip}
            </span>
          ))
        )}
      </div>

      {rangeError && (
        <p className="mt-3 text-sm text-amber-600" role="alert">
          {rangeError}
        </p>
      )}
      <div className="mt-5">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <ComboBox
            label="Značka"
            placeholder="Značka"
            value={resolvedFilters.brandValue}
            onChange={(value) => setFilter("brand", value)}
            options={resolvedFilters.brandOptions}
            displayLabel={resolvedFilters.brandLabel}
          />
          <ComboBox
            label="Model"
            placeholder="Model"
            value={resolvedFilters.modelValue}
            onChange={(value) => setFilter("model", value)}
            options={resolvedFilters.modelOptions}
            displayLabel={resolvedFilters.modelLabel}
          />
          <Select
            label="Rok od"
            placeholder="Libovolně"
            value={filters.yearFrom || "Libovolně"}
            onChange={(value) =>
              setFilter("yearFrom", value === "Libovolně" ? "" : value ?? "")
            }
            options={YEAR_OPTIONS}
          />
          <Select
            label="Rok do"
            placeholder="Libovolně"
            value={filters.yearTo || "Libovolně"}
            onChange={(value) =>
              setFilter("yearTo", value === "Libovolně" ? "" : value ?? "")
            }
            options={YEAR_OPTIONS}
          />
          <ComboBox
            label="Motor"
            placeholder="Motor"
            value={fromEngineKey(filters.engine) ?? filters.engine ?? ""}
            onChange={(value) => setFilter("engine", value ? toEngineKey(value) ?? null : null)}
            options={[...ENGINE_OPTIONS]}
          />
          <Select
            label="Nájezd od"
            placeholder="Libovolně"
            value={mileageLabel(filters.mileageFrom)}
            onChange={(label) => {
              const option = MILEAGE_OPTIONS.find((item) => item.label === label);
              setFilter("mileageFrom", option ? option.value : "");
            }}
            options={MILEAGE_OPTIONS.map((item) => item.label)}
          />
          <Select
            label="Nájezd do"
            placeholder="Libovolně"
            value={mileageLabel(filters.mileageTo)}
            onChange={(label) => {
              const option = MILEAGE_OPTIONS.find((item) => item.label === label);
              setFilter("mileageTo", option ? option.value : "");
            }}
            options={MILEAGE_OPTIONS.map((item) => item.label)}
          />
          <MultiSelect
            label="Palivo"
            placeholder="Palivo"
            value={filters.fuels}
            onChange={(value) => setFilter("fuels", value)}
            options={FUEL_OPTIONS}
          />
        </div>

        {advancedOpen && (
          <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Převodovka"
                placeholder="Převodovka"
                value={filters.transmission}
                onChange={(value) => setFilter("transmission", value)}
                options={TRANSMISSION_OPTIONS}
              />
              <Select
                label="Karoserie"
                placeholder="Karoserie"
                value={filters.bodyType}
                onChange={(value) => setFilter("bodyType", value)}
                options={BODY_OPTIONS}
              />
              <Select
                label="Pohon"
                placeholder="Pohon"
                value={filters.drivetrain}
                onChange={(value) => setFilter("drivetrain", value)}
                options={DRIVETRAIN_OPTIONS}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <MultiComboBox
                label="Výbava / výbavová linie"
                placeholder="Ambition, Style, RS…"
                value={filters.trim ? [filters.trim] : []}
                onChange={(value) => setFilter("trim", value[0] ?? null)}
                options={TRIM_OPTIONS}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

