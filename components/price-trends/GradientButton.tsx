"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";

type GradientButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "ghost";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export function GradientButton(
  props: GradientButtonProps & { children?: React.ReactNode },
) {
  const { className, children, variant = "primary", leftIcon, rightIcon, ...rest } =
    props;
  const baseClasses =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-[160ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

  const variantClasses =
    variant === "primary"
      ? "bg-[linear-gradient(135deg,#3B82F6,#22C55E)] text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] hover:shadow-[0_0_0_1px_rgba(56,189,248,0.55),0_20px_45px_rgba(34,197,94,0.55)]"
      : "border border-white/60 bg-white/70 text-slate-800/90 hover:bg-white/90 hover:border-slate-200 shadow-[0_8px_26px_rgba(15,23,42,0.08)] backdrop-blur-md";

  return (
    <motion.button
      type={rest.type ?? "button"}
      className={cn(baseClasses, variantClasses, className)}
      whileHover={{ y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.97, y: 0 }}
      {...rest}
    >
      {leftIcon && (
        <span className="inline-flex h-4 w-4 items-center justify-center">
          {leftIcon}
        </span>
      )}
      <span>{children}</span>
      {rightIcon && (
        <span className="inline-flex h-4 w-4 items-center justify-center">
          {rightIcon}
        </span>
      )}
    </motion.button>
  );
}

