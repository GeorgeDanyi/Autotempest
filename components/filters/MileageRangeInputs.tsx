"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const inputStyles =
  "h-[46px] w-full rounded-[14px] border border-[rgba(15,23,42,0.10)] bg-white/70 px-3 text-sm text-slate-800 shadow-sm transition-[box-shadow,border-color] outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/30 placeholder:text-slate-400";

const MILEAGE_PRESETS = [
  { label: "Libovolně", from: "", to: "" },
  { label: "0", from: "0", to: "" },
  { label: "50 000", from: "0", to: "50000" },
  { label: "100 000", from: "0", to: "100000" },
  { label: "150 000", from: "0", to: "150000" },
  { label: "200 000", from: "0", to: "200000" },
  { label: "250 000", from: "0", to: "250000" },
  { label: "300 000", from: "0", to: "300000" },
];

function formatKm(value: string) {
  if (!value) return "";
  const num = parseInt(value.replace(/\D/g, ""), 10);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("cs-CZ");
}

export type MileageRangeInputsProps = {
  labelFrom?: string;
  labelTo?: string;
  valueFrom: string;
  valueTo: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  showPresets?: boolean;
};

export function MileageRangeInputs({
  labelFrom = "Nájezd od",
  labelTo = "Nájezd do",
  valueFrom,
  valueTo,
  onChangeFrom,
  onChangeTo,
  onBlur,
  disabled,
  className,
  showPresets = true,
}: MileageRangeInputsProps) {
  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    onChangeFrom(raw);
  };
  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    onChangeTo(raw);
  };

  const applyPreset = (from: string, to: string) => {
    onChangeFrom(from);
    onChangeTo(to);
  };

  const displayFromVal = valueFrom ? formatKm(valueFrom) : "";
  const displayToVal = valueTo ? formatKm(valueTo) : "";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-xs font-medium tracking-wide text-slate-500">
            {labelFrom}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={displayFromVal}
            onChange={handleFromChange}
            onBlur={onBlur}
            disabled={disabled}
            placeholder="0"
            className={cn(inputStyles)}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium tracking-wide text-slate-500">
            {labelTo}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={displayToVal}
            onChange={handleToChange}
            onBlur={onBlur}
            disabled={disabled}
            placeholder="—"
            className={cn(inputStyles)}
          />
        </div>
      </div>
      {showPresets && (
        <div className="flex flex-wrap gap-1.5">
          {MILEAGE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.from, p.to)}
              className="rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
