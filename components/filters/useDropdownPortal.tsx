"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";

const PANEL_STYLES = "fixed z-[999]";
const PANEL_INNER =
  "max-h-[320px] overflow-y-auto rounded-b-[14px] rounded-t-[8px] border border-[rgba(15,23,42,0.10)] bg-white/[0.92] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.10)] backdrop-blur-xl";

export type DropdownPosition = { top: number; left: number; width: number };

export function useDropdownPortal(open: boolean) {
  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<DropdownPosition | null>(null);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return { triggerRef, panelRef, position, PANEL_STYLES, PANEL_INNER };
}

export function renderDropdownPortal(
  open: boolean,
  position: DropdownPosition | null,
  panelRef: React.RefObject<HTMLDivElement | null>,
  children: React.ReactNode,
  panelClassName?: string,
) {
  if (!open || !position) return null;
  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className={PANEL_STYLES}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: position.width,
        maxWidth: position.width,
      }}
    >
      <div className={cn(PANEL_INNER, panelClassName)}>{children}</div>
    </div>,
    document.body,
  );
}

export { PANEL_INNER as DROPDOWN_PANEL_INNER };
