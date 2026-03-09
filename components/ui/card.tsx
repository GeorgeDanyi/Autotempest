import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-1 flex items-center justify-between gap-2", className)}
      {...props}
    />
  )
}

function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold leading-tight", className)}
      {...props}
    />
  )
}

function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("space-y-0.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardContent }

