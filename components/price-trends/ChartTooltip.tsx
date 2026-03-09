"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type PayloadEntry = {
  name: string;
  value: number;
  color?: string;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: PayloadEntry[];
  valueFormatter?: (value: number, name?: string) => string;
  labelFormatter?: (label: string | number) => string;
  className?: string;
};

export function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter,
  labelFormatter,
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const formattedLabel = labelFormatter ? labelFormatter(label!) : label;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[rgba(148,163,184,0.35)] bg-white/95 px-3.5 py-2.5 text-xs shadow-[0_18px_55px_rgba(15,23,42,0.32)] backdrop-blur-xl",
        className,
      )}
    >
      {formattedLabel && (
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
          {formattedLabel}
        </div>
      )}
      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <div
            key={`${entry.name}-${index}`}
            className="flex items-center justify-between gap-3 text-[11px] text-slate-600"
          >
            <div className="flex items-center gap-1.5">
              {entry.color && (
                <span
                  className="inline-flex h-1.5 w-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
              )}
              <span className="text-[11px] text-slate-500">{entry.name}</span>
            </div>
            <span className="font-medium tabular-nums text-slate-900">
              {valueFormatter
                ? valueFormatter(entry.value, entry.name)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

