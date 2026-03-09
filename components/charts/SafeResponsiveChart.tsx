"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type SafeResponsiveChartProps = {
  className: string;
  children: ReactNode;
  placeholderClassName?: string;
};

export function SafeResponsiveChart({
  className,
  children,
  placeholderClassName,
}: SafeResponsiveChartProps) {
  const [mounted, setMounted] = useState(false);
  const [hasSize, setHasSize] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setHasSize(rect.width > 0 && rect.height > 0);
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [mounted]);

  const showChart = mounted && hasSize;

  return (
    <div ref={wrapperRef} className={`w-full ${className}`}>
      {!showChart ? (
        <div
          className={`h-full w-full animate-pulse rounded-lg bg-slate-100/80 ${
            placeholderClassName ?? ""
          }`}
          aria-hidden
        />
      ) : (
        children
      )}
    </div>
  );
}

