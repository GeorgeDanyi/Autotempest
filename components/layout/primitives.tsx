import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Card as UiCard,
  CardContent as UiCardContent,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from "@/components/ui/card"
import { Badge as UiBadge } from "@/components/ui/badge"

type ContainerProps = React.HTMLAttributes<HTMLDivElement>

export function Container({ className, ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  )
}

type SectionProps = React.HTMLAttributes<HTMLElement>

export function Section({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "py-10 sm:py-12 lg:py-16",
        className,
      )}
      {...props}
    />
  )
}

// Re-export the design system Card & Badge so pages can import from a single place
export const Card = UiCard
export const CardHeader = UiCardHeader
export const CardTitle = UiCardTitle
export const CardContent = UiCardContent
export const Badge = UiBadge

type StatProps = {
  label: string
  value: string
  helper?: string
  tone?: "default" | "muted" | "positive" | "negative"
  icon?: React.ReactNode
  className?: string
}

export function Stat({
  label,
  value,
  helper,
  tone = "default",
  icon,
  className,
}: StatProps) {
  const toneClasses =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : tone === "muted"
          ? "text-neutral-500"
          : "text-neutral-900"

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.04)] backdrop-blur-sm",
        className,
      )}
    >
      {icon && (
        <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-neutral-500">
          {icon}
        </div>
      )}
      <div className="space-y-0.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </div>
        <div className={cn("text-lg font-semibold tracking-tight", toneClasses)}>
          {value}
        </div>
        {helper && (
          <p className="text-[11px] text-neutral-500">
            {helper}
          </p>
        )}
      </div>
    </div>
  )
}

type KpiTileProps = {
  eyebrow?: string
  label: string
  value: string
  delta?: string
  deltaTone?: "positive" | "negative" | "neutral"
  helper?: string
  icon?: React.ReactNode
  className?: string
}

export function KpiTile({
  eyebrow,
  label,
  value,
  delta,
  deltaTone = "neutral",
  helper,
  icon,
  className,
}: KpiTileProps) {
  return (
    <UiCard
      className={cn(
        "relative overflow-hidden border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm",
        "before:pointer-events-none before:absolute before:inset-x-0 before:-top-20 before:h-40 before:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),transparent_60%)]",
        className,
      )}
    >
      <UiCardHeader className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-1">
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
              {eyebrow}
            </p>
          )}
          <UiCardTitle className="text-sm font-medium text-neutral-900">
            {label}
          </UiCardTitle>
        </div>
        {icon && (
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-neutral-500">
            {icon}
          </div>
        )}
      </UiCardHeader>
      <UiCardContent className="relative z-10 space-y-2 text-xs text-neutral-500">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight text-neutral-900">
            {value}
          </p>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                deltaTone === "positive" &&
                  "bg-emerald-50 text-emerald-700",
                deltaTone === "negative" &&
                  "bg-red-50 text-red-700",
                deltaTone === "neutral" &&
                  "bg-neutral-50 text-neutral-600",
              )}
            >
              {delta}
            </span>
          )}
        </div>
        {helper && (
          <p className="text-[11px] text-neutral-500">
            {helper}
          </p>
        )}
      </UiCardContent>
    </UiCard>
  )
}

