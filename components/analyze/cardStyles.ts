/**
 * Design systém karet pro /analyze – sjednoceno s homepage (GlassCard vzhled).
 * Konzistentní padding, rozestupy a typografie.
 */

/** Základ karty – vizuálně jako GlassCard (bez motion) */
export const ANALYZE_CARD =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]";

/** Karta s levým akcentem */
export const ANALYZE_CARD_ACCENT =
  "rounded-2xl border-l-4 border-l-sky-500 border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]";

/** Jednotný vnitřní padding karet – dost prostoru ze všech stran */
export const ANALYZE_CARD_PADDING = "p-6 sm:p-7";

/** Sekční label nad obsahem – jednotný v celé stránce */
export const CARD_LABEL =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400";

/** Hlavní číselná hodnota */
export const CARD_VALUE =
  "font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-2xl";

/** Sekundární text / popis */
export const CARD_DESC = "text-xs text-slate-500 leading-snug";

/** Nadpis v kartě */
export const CARD_TITLE = "text-sm font-semibold tracking-tight text-slate-800";
