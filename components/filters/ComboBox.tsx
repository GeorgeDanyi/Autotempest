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

export type ComboBoxOption = { value: string; label: string };

export type ComboBoxProps = {
  label: string;
  placeholder?: string;
  /** Selected value (e.g. brand string or model_key). */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Options: pole řetězců (value=label) nebo pole { value, label } pro oddělený value/label. */
  options: readonly string[] | readonly ComboBoxOption[];
  /** Když options jsou prázdné ale value je nastavené (např. options ještě načítány), zobrazí se tento label místo "Načítám…". */
  displayLabel?: string | null;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  /** Pro options jako string[]: nepoužívá se. Pro { value, label }: volitelně rozšíří vyhledávací text (např. label + " " + value). */
  getOptionSearchString?: (option: ComboBoxOption) => string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function normalizeOptions(
  options: readonly string[] | readonly ComboBoxOption[]
): ComboBoxOption[] {
  if (options.length === 0) return [];
  const first = options[0];
  if (typeof first === "string") {
    return (options as readonly string[]).map((s) => ({ value: s, label: s }));
  }
  return [...(options as readonly ComboBoxOption[])];
}

export function ComboBox({
  label,
  placeholder = "Vybrat…",
  value,
  onChange,
  options,
  displayLabel,
  disabled,
  className,
  searchable = true,
  getOptionSearchString,
  open: openProp,
  onOpenChange,
}: ComboBoxProps) {
  const [openUncontrolled, setOpenUncontrolled] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openUncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setOpenUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );
  const [search, setSearch] = React.useState("");
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const { triggerRef, panelRef, position } = useDropdownPortal(open);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  const optionsNormalized = React.useMemo(() => normalizeOptions(options), [options]);
  const searchLower = search.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      searchable && searchLower
        ? optionsNormalized.filter((opt) => {
            const searchText = getOptionSearchString
              ? getOptionSearchString(opt)
              : `${opt.label} ${opt.value}`;
            return searchText.toLowerCase().includes(searchLower);
          })
        : optionsNormalized,
    [optionsNormalized, searchable, searchLower, getOptionSearchString]
  );

  const matchedOption =
    optionsNormalized.find((o) => o.value === value) ??
    (value
      ? optionsNormalized.find(
          (o) => o.value.toLowerCase() === value.toLowerCase()
        )
      : null);

  const displayValue =
    optionsNormalized.length === 0 && value
      ? (displayLabel ?? "Načítám…")
      : matchedOption
        ? matchedOption.label
        : (value && displayLabel ? displayLabel : "");

  const select = React.useCallback(
    (opt: ComboBoxOption) => {
      onChange(opt.value);
      setOpen(false);
      setSearch("");
      setHighlightIndex(0);
    },
    [onChange, setOpen],
  );

  // Close on outside click + ESC
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        panelRef.current?.contains(t)
      )
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

  // Keyboard nav when panel is open
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[highlightIndex]) {
        e.preventDefault();
        select(filtered[highlightIndex]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, filtered, highlightIndex, select]);

  React.useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  // When opened (e.g. by parent after brand select), focus trigger or search input
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        if (searchable && inputRef.current) {
          inputRef.current.focus();
        } else {
          buttonRef.current?.focus();
        }
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open, searchable]);


  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-medium tracking-wide text-slate-500">
        {label}
      </label>
      <div ref={triggerRef} className="relative w-full">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen(!open);
            if (!open) setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={cn(controlStyles, "cursor-pointer")}
        >
          <span className={displayValue ? "text-slate-800" : "text-slate-400"}>
            {displayValue || placeholder}
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
              {searchable && (
                <div className="sticky top-0 z-[2] border-b border-black/[0.06] bg-white pb-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Hledat…"
                    className="w-full rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-slate-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
                  />
                </div>
              )}
              <div
                ref={listRef}
                className="max-h-[280px] overflow-y-auto"
                role="listbox"
              >
                {filtered.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-slate-500">
                    {optionsNormalized.length === 0 ? "Načítám…" : "Žádné výsledky"}
                  </p>
                ) : (
                  filtered.map((opt, i) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={value === opt.value}
                      onClick={() => select(opt)}
                      className={cn(
                        "flex h-[40px] w-full cursor-pointer items-center gap-2 rounded-lg px-[14px] py-[10px] text-left text-[13px] transition-colors",
                        value === opt.value
                          ? "bg-sky-50 text-sky-800"
                          : "text-slate-700 hover:bg-[rgba(15,23,42,0.05)]",
                        i === highlightIndex && "bg-[rgba(15,23,42,0.05)]",
                      )}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {value === opt.value && (
                          <Check className="h-4 w-4 text-sky-600" />
                        )}
                      </span>
                      <span className="flex-1 text-left">{opt.label}</span>
                    </button>
                  ))
                )}
              </div>
            </>,
        )}
      </div>
    </div>
  );
}
