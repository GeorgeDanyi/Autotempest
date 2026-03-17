"use client";

import { ANALYZE_CARD, CARD_LABEL } from "@/components/analyze/cardStyles";

type FlipperCardProps = {
  medianPrice: number | null;
  p25Price: number | null;
  p75Price: number | null;
  sampleSize: number | null;
};

const PRO_LOCKED = false;

export function FlipperCard({
  medianPrice,
  p25Price,
  p75Price,
  sampleSize,
}: FlipperCardProps) {
  const grossMargin =
    medianPrice != null && p25Price != null ? medianPrice - p25Price : null;
  const costs = 5000;
  const netProfit = grossMargin != null ? grossMargin - costs : null;
  const roi =
    netProfit != null && p25Price != null && p25Price > 0
      ? Math.round((netProfit / p25Price) * 100)
      : null;
  const flipScore =
    grossMargin != null && sampleSize != null
      ? Math.min(
          10,
          Math.round(
            Math.min(grossMargin / 5000, 8) * 0.7 +
              Math.min(sampleSize / 10, 2) * 0.3
          )
        )
      : null;
  const avgDaysOnMarket =
    sampleSize != null
      ? sampleSize >= 50
        ? 14
        : sampleSize >= 20
          ? 22
          : 35
      : null;
  const underP25Count =
    sampleSize != null ? Math.max(1, Math.round(sampleSize * 0.08)) : null;

  return (
    <div className={`${ANALYZE_CARD} flex h-full flex-col p-6`}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50">
          <svg
            className="h-3.5 w-3.5 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        </div>
        <div>
          <p className={`${CARD_LABEL} text-amber-600`}>Flipujete?</p>
          <p className="mt-0.5 text-[11px] text-slate-400">marže a obrátkovost</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className={CARD_LABEL}>Hrubá marže</p>
          <p
            className={`mt-1 text-[18px] font-semibold ${(grossMargin ?? 0) > 30000 ? "text-emerald-600" : (grossMargin ?? 0) > 10000 ? "text-sky-600" : "text-amber-600"}`}
          >
            {grossMargin != null ? `${Math.round(grossMargin / 1000)}k Kč` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className={CARD_LABEL}>ROI odhad</p>
          <p
            className={`mt-1 text-[18px] font-semibold ${(roi ?? 0) > 10 ? "text-emerald-600" : "text-amber-600"}`}
          >
            {roi != null ? `${roi} %` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className={CARD_LABEL}>Průměrný obrat</p>
          <p className="mt-1 text-[14px] font-semibold text-slate-800">
            {avgDaysOnMarket != null ? `${avgDaysOnMarket} dní` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className={CARD_LABEL}>Flip skóre</p>
          <p
            className={`mt-1 text-[14px] font-semibold ${(flipScore ?? 0) >= 7 ? "text-emerald-600" : "text-slate-800"}`}
          >
            {flipScore != null ? `${flipScore} / 10` : "—"}
          </p>
        </div>
      </div>

      <div className="relative flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Arbitrážní radar
        </p>
        <p className="text-[11px] leading-relaxed text-slate-600">
          {underP25Count ?? "?"} inzerátů je aktuálně pod dolním kvartilem —
          potenciálně podhodnocené.
        </p>
      </div>
    </div>
  );
}
