"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type ChipFilterProps = {
  label: string;
  helper?: string;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
};

export function ChipFilter({
  label,
  helper,
  icon,
  className,
  children,
  open: openProp,
  onOpenChange,
  disabled,
}: ChipFilterProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  // Compute portal position relative to viewport
  React.useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportWidth = window.innerWidth;
      const minWidth = 320;
      let left = rect.left;
      const desiredWidth = Math.max(minWidth, rect.width);
      const maxLeft = viewportWidth - desiredWidth - 16;
      if (left > maxLeft) left = Math.max(16, maxLeft);

      const top = rect.bottom + 8;

      setPosition({
        top,
        left,
        width: desiredWidth,
      });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  // Close on outside click + ESC
  React.useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const panel =
    open && position
      ? ReactDOM.createPortal(
          <div
            ref={panelRef}
            className="fixed z-[999] text-[11px] text-slate-600"
            style={{
              top: position.top,
              left: position.left,
              minWidth: position.width,
              maxWidth: "min(400px, 100vw - 32px)",
            }}
          >
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white/85 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.10)] backdrop-blur-xl">
              {children ? (
                children
              ) : (
                <>
                  <p className="font-medium text-slate-800">{label}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {helper ??
                      "Ukázkový filtr. V produkci zde otevřete detailní možnosti pro tento parametr."}
                  </p>
                </>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={containerRef} className={cn("relative", className)}>
        <motion.button
          ref={buttonRef}
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-[rgba(148,163,184,0.4)] bg-white/50 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-colors hover:border-sky-400/70 hover:bg-white",
            open && "border-sky-500/70 bg-white text-sky-800",
            disabled && "cursor-not-allowed opacity-60",
          )}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen(!open);
          }}
          whileTap={{ scale: 0.96 }}
        >
          {icon && (
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[11px] text-slate-500">
              {icon}
            </span>
          )}
          <span>{label}</span>
        </motion.button>
      </div>
      {panel}
    </>
  );
}


