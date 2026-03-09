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

export type MultiComboBoxProps = {
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: readonly string[];
  disabled?: boolean;
  className?: string;
};

export function MultiComboBox({
  label,
  placeholder = "Vybrat…",
  value,
  onChange,
  options,
  disabled,
  className,
}: MultiComboBoxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const { triggerRef, panelRef, position } = useDropdownPortal(open);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const filtered =
    search.trim() === ""
      ? [...options]
      : options.filter((o) =>
          o.toLowerCase().includes(search.trim().toLowerCase()),
        );

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
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
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
          onClick={() => {
            setOpen(!open);
            if (!open) setTimeout(() => inputRef.current?.focus(), 0);
          }}
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
            <div className="sticky top-0 z-[2] border-b border-black/[0.06] bg-white pb-2">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat výbavu…"
                className="mb-2 w-full rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-slate-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
              />
              {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {value.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="max-h-[220px] space-y-0.5 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-xs text-slate-500">
                  Žádné výsledky
                </p>
              ) : (
                filtered.map((opt) => {
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
                })
              )}
            </div>
          </>,
        )}
      </div>
    </div>
  );
}
