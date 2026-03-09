"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { ComboBox, Select } from "@/components/filters";
import { fromEngineKey, toEngineKey, normalizeEngineParam, ENGINE_OPTIONS as ENGINE_OPTIONS_BASE } from "@/lib/analyze/engineKeys";

const YEAR_OPTIONS = [
  "Libovolně",
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

const ENGINE_OPTIONS = ["Libovolně", ...ENGINE_OPTIONS_BASE];

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
  { label: "Libovolně", value: "" },
  { label: "do 50 000 km", value: "50000" },
  { label: "do 100 000 km", value: "100000" },
  { label: "do 150 000 km", value: "150000" },
  { label: "do 200 000 km", value: "200000" },
  { label: "do 250 000 km", value: "250000" },
  { label: "do 300 000 km", value: "300000" },
];

const FUEL_OPTIONS = ["Libovolně", "Benzín", "Nafta", "Hybrid", "Elektro", "LPG/CNG"];

export function FilterBar() {
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
      if (value && value !== "Libovolně") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const currentEngineLabel = fromEngineKey(current.engineKey);

  const currentYearLabel = current.yearFrom && current.yearFrom === current.yearTo
    ? current.yearFrom
    : "Libovolně";

  const currentMileageLabel =
    MILEAGE_OPTIONS.find((opt) => opt.value === (current.mileageTo ?? ""))?.label ??
    "Libovolně";

  const currentFuelLabel = current.fuel ?? "Libovolně";

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <p className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:inline">
        Segment
      </p>
      <div className="grid flex-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <ComboBox
          label="Značka"
          placeholder="Značka"
          value={current.brand}
          onChange={(value) =>
            updateParams({
              brand: value,
            })
          }
          options={BRAND_OPTIONS}
        />
        <ComboBox
          label="Model"
          placeholder="Model"
          value={current.model}
          onChange={(value) =>
            updateParams({
              model: value,
            })
          }
          options={MODEL_OPTIONS}
        />
        <Select
          label="Rok"
          placeholder="Libovolně"
          value={currentYearLabel}
          onChange={(value) => {
            if (!value || value === "Libovolně") {
              updateParams({ yearFrom: null, yearTo: null });
            } else {
              const yearValue = value;
              const params: Record<string, string | null> = {
                yearFrom: yearValue,
                yearTo: yearValue,
              };
              updateParams(params);
            }
          }}
          options={YEAR_OPTIONS}
        />
        <Select
          label="Motor"
          placeholder="Libovolně"
          value={currentEngineLabel ?? "Libovolně"}
          onChange={(value) => {
            if (!value || value === "Libovolně") {
              updateParams({ engine: null });
            } else {
              const engineKey = toEngineKey(value) ?? null;
              updateParams({ engine: engineKey });
            }
          }}
          options={ENGINE_OPTIONS}
        />
        <Select
          label="Nájezd"
          placeholder="Libovolně"
          value={currentMileageLabel}
          onChange={(label) => {
            const opt = MILEAGE_OPTIONS.find((item) => item.label === label);
            updateParams({
              mileageTo: opt?.value ?? "",
            });
          }}
          options={MILEAGE_OPTIONS.map((opt) => opt.label)}
        />
        <Select
          label="Palivo"
          placeholder="Libovolně"
          value={currentFuelLabel}
          onChange={(value) => {
            if (!value || value === "Libovolně") {
              updateParams({ fuels: null });
            } else {
              updateParams({ fuels: value });
            }
          }}
          options={FUEL_OPTIONS}
        />
      </div>
    </div>
  );
}

