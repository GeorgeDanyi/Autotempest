"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { ComboBox, Select } from "@/components/filters";
import { fromEngineKey, toEngineKey, normalizeEngineParam, ENGINE_OPTIONS as ENGINE_OPTIONS_BASE } from "@/lib/analyze/engineKeys";

const LIBOVOLNE = "Libovolně";

const YEAR_OPTIONS = [
  LIBOVOLNE,
  ...Array.from({ length: 2026 - 1995 + 1 }, (_, index) => String(2026 - index)),
];

const BRAND_OPTIONS = [
  "Škoda",
  "Volkswagen",
  "BMW",
  "Audi",
  "Mercedes-Benz",
  "Toyota",
  "Hyundai",
  "Kia",
];

const ENGINE_OPTIONS = [LIBOVOLNE, ...ENGINE_OPTIONS_BASE];

const MODEL_OPTIONS = [
  "Octavia",
  "Superb",
  "Fabia",
  "Kodiaq",
  "Golf",
  "Passat",
  "BMW 3",
  "Audi A4",
];

const MILEAGE_OPTIONS = [
  { label: LIBOVOLNE, value: "" },
  { label: "do 50 000 km", value: "50000" },
  { label: "do 100 000 km", value: "100000" },
  { label: "do 150 000 km", value: "150000" },
  { label: "do 200 000 km", value: "200000" },
  { label: "do 250 000 km", value: "250000" },
  { label: "do 300 000 km", value: "300000" },
];

const FUEL_OPTIONS = [LIBOVOLNE, "Benzín", "Nafta", "Hybrid", "Elektro", "LPG/CNG"];

export function AnalysisControlStrip() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = useMemo(() => {
    const fuelParam = searchParams.get("fuels");
    const firstFuel = fuelParam ? fuelParam.split(",")[0] : null;
    return {
      brand: searchParams.get("brand"),
      model: searchParams.get("model"),
      yearFrom: searchParams.get("yearFrom"),
      yearTo: searchParams.get("yearTo"),
      engineKey: normalizeEngineParam(searchParams.get("engine")),
      mileageTo: searchParams.get("mileageTo"),
      fuel: firstFuel,
    };
  }, [searchParams]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== LIBOVOLNE) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const reset = () => {
    router.push(pathname, { scroll: false });
  };

  const currentEngineLabel = fromEngineKey(current.engineKey);
  const currentYearLabel =
    current.yearFrom && current.yearFrom === current.yearTo
      ? current.yearFrom
      : LIBOVOLNE;
  const currentMileageLabel =
    MILEAGE_OPTIONS.find((opt) => opt.value === (current.mileageTo ?? ""))
      ?.label ?? LIBOVOLNE;
  const currentFuelLabel = current.fuel ?? LIBOVOLNE;

  return (
    <div
      className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.10)]"
      aria-label="Segment filters"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:inline">
          Segment
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <ComboBox
            label="Značka"
            placeholder="Značka"
            value={current.brand}
            onChange={(v) => updateParams({ brand: v })}
            options={BRAND_OPTIONS}
            className="min-w-0 max-w-[140px] sm:max-w-[160px]"
          />
          <ComboBox
            label="Model"
            placeholder="Model"
            value={current.model}
            onChange={(v) => updateParams({ model: v })}
            options={MODEL_OPTIONS}
            className="min-w-0 max-w-[140px] sm:max-w-[160px]"
          />
          <Select
            label="Rok"
            placeholder={LIBOVOLNE}
            value={currentYearLabel}
            onChange={(v) => {
              if (!v || v === LIBOVOLNE) updateParams({ yearFrom: null, yearTo: null });
              else updateParams({ yearFrom: v, yearTo: v });
            }}
            options={YEAR_OPTIONS}
            className="min-w-0 max-w-[100px] sm:max-w-[110px]"
          />
          <Select
            label="Motor"
            placeholder={LIBOVOLNE}
            value={currentEngineLabel ?? LIBOVOLNE}
            onChange={(v) =>
              updateParams({ engine: v ? toEngineKey(v) : null })
            }
            options={ENGINE_OPTIONS}
            className="min-w-0 max-w-[120px] sm:max-w-[130px]"
          />
          <Select
            label="Nájezd"
            placeholder={LIBOVOLNE}
            value={currentMileageLabel}
            onChange={(label) => {
              const opt = MILEAGE_OPTIONS.find((item) => item.label === label);
              updateParams({ mileageTo: opt?.value ?? "" });
            }}
            options={MILEAGE_OPTIONS.map((o) => o.label)}
            className="min-w-0 max-w-[120px] sm:max-w-[130px]"
          />
          <Select
            label="Palivo"
            placeholder={LIBOVOLNE}
            value={currentFuelLabel}
            onChange={(v) =>
              updateParams({ fuels: v && v !== LIBOVOLNE ? v : null })
            }
            options={FUEL_OPTIONS}
            className="min-w-0 max-w-[120px] sm:max-w-[130px]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-800"
            aria-label="Pokročilé filtry"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pokročilé</span>
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-800"
            aria-label="Obnovit filtry"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Resetovat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
