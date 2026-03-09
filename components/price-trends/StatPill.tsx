"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type StatPillProps = {
  label?: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "info";
  className?: string;
};

export function StatPill({
  label,
  value,
  tone = "default",
  className,
}: StatPillProps) {
  const toneClasses =
    tone === "positive"
      ? "bg-emerald-50/80 text-emerald-700 ring-emerald-500/15"
      : tone === "negative"
        ? "bg-red-50/80 text-red-700 ring-red-500/15"
        : tone === "info"
          ? "bg-sky-50/80 text-sky-700 ring-sky-500/15"
          : "bg-white/80 text-slate-900 ring-slate-900/5";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-[0_10px_28px_rgba(15,23,42,0.12)] ring-1 backdrop-blur",
        toneClasses,
        className,
      )}
    >
      {label && (
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500/80">
          {label}
        </span>
      )}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

