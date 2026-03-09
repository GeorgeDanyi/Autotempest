"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type GlassCardProps = {
  className?: string;
  children?: React.ReactNode;
  /** Disable hover lift and tap scale effect */
  noHoverEffect?: boolean;
} & React.ComponentProps<typeof motion.div>;

export function GlassCard({ className, children, noHoverEffect, ...rest }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/65",
        "shadow-[0_10px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl",
        "transition-all duration-[160ms] ease-out",
        className,
      )}
      whileHover={noHoverEffect ? undefined : { y: -4, boxShadow: "0 18px 45px rgba(15,23,42,0.14)" }}
      whileTap={noHoverEffect ? undefined : { scale: 0.98 }}
      {...rest}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/10 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),transparent_60%)]" />

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

