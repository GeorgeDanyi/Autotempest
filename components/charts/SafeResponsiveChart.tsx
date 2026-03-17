"use client";
import { useEffect, useState, type ReactNode } from "react";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-full ${className}`}>
        <div
          className={`h-full w-full animate-pulse rounded-lg bg-slate-100/80 ${
            placeholderClassName ?? ""
          }`}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {children}
    </div>
  );
}


