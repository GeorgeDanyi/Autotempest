"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDropdownPortal,
  renderDropdownPortal,
} from "./useDropdownPortal";

const controlStyles =
  "flex h-[46px] min-h-[46px] w-full items-center justify-between gap-2 rounded-[14px] border border-[rgba(15,23,42,0.10)] bg-white/70 px-3 text-left text-sm text-slate-800 shadow-sm transition-[box-shadow,border-color] outline-none hover:border-[rgba(15,23,42,0.18)] focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60";

export type MultiSelectProps = {
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: readonly string[];
  disabled?: boolean;
  className?: string;
};

export function MultiSelect({
  label,
  placeholder = "Vybrat…",
  value,
  onChange,
  options,
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const { triggerRef, panelRef, position } = useDropdownPortal(open);

  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t))
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, triggerRef, panelRef]);

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]
        : `${value[0]} +${value.length - 1}`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-medium tracking-wide text-slate-500">
        {label}
      </label>
      <div ref={triggerRef} className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(controlStyles, "cursor-pointer")}
        >
          <span
            className={
              value.length > 0 ? "text-slate-800" : "text-slate-400"
            }
          >
            {summary}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-slate-400", open && "rotate-180")}
          />
        </button>
        {renderDropdownPortal(
          open,
          position,
          panelRef,
          <>
            {value.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {value.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800 ring-1 ring-sky-200"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-[260px] space-y-0.5 overflow-y-auto">
              {options.map((opt) => {
                const checked = value.includes(opt);
                return (
                  <label
                    key={opt}
                    className={cn(
                      "flex h-[40px] w-full cursor-pointer items-center gap-2 rounded-lg px-[14px] py-[10px] text-[13px] transition-colors hover:bg-[rgba(15,23,42,0.05)]",
                      checked && "bg-sky-50/80",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white",
                        checked
                          ? "border-sky-500 bg-sky-500"
                          : "border-slate-300 bg-white",
                      )}
                    >
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1 text-left">{opt}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt)}
                      className="sr-only"
                    />
                  </label>
                );
              })}
            </div>
          </>,
        )}
      </div>
    </div>
  );
}
