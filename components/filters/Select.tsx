"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDropdownPortal,
  renderDropdownPortal,
} from "./useDropdownPortal";

const controlStyles =
  "flex h-[46px] w-full items-center justify-between gap-2 rounded-[14px] border border-[rgba(15,23,42,0.10)] bg-white/70 px-3 text-left text-sm text-slate-800 shadow-sm transition-[box-shadow,border-color] outline-none hover:border-[rgba(15,23,42,0.18)] focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/30 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60";

export type SelectProps = {
  label: string;
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: readonly string[];
  disabled?: boolean;
  className?: string;
};

export function Select({
  label,
  placeholder = "Vybrat…",
  value,
  onChange,
  options,
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const { triggerRef, panelRef, position } = useDropdownPortal(open);

  const select = React.useCallback(
    (option: string) => {
      onChange(option);
      setOpen(false);
      setHighlightIndex(0);
    },
    [onChange],
  );

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

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && options[highlightIndex] !== undefined) {
        e.preventDefault();
        select(options[highlightIndex]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, options, highlightIndex, select]);

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
          <span className={value ? "text-slate-800" : "text-slate-400"}>
            {value ?? placeholder}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-slate-400", open && "rotate-180")}
          />
        </button>
        {renderDropdownPortal(
          open,
          position,
          panelRef,
          <div className="max-h-[280px] overflow-y-auto" role="listbox">
            {options.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500">Žádné možnosti</p>
            ) : (
              options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={value === opt}
                  onClick={() => select(opt)}
                  className={cn(
                    "flex h-[40px] w-full cursor-pointer items-center gap-2 rounded-lg px-[14px] py-[10px] text-left text-[13px] transition-colors",
                    value === opt
                      ? "bg-sky-50 text-sky-800"
                      : "text-slate-700 hover:bg-[rgba(15,23,42,0.05)]",
                    i === highlightIndex && "bg-[rgba(15,23,42,0.05)]",
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {value === opt && (
                      <Check className="h-4 w-4 text-sky-600" />
                    )}
                  </span>
                  <span className="flex-1 text-left">{opt}</span>
                </button>
              ))
            )}
          </div>,
        )}
      </div>
    </div>
  );
}
