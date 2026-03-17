"use client";

import { ANALYZE_CARD, CARD_LABEL } from "@/components/analyze/cardStyles";

type SellerCardProps = {
  medianPrice: number | null;
  p25Price: number | null;
  p75Price: number | null;
  sampleSize: number | null;
};

export function SellerCard({
  medianPrice,
  p25Price,
  p75Price,
  sampleSize,
}: SellerCardProps) {
  const quickSalePrice = p25Price != null ? Math.round(p25Price * 0.97) : null;
  const normalPrice = medianPrice ?? null;
  const maxPrice = p75Price != null ? Math.round(p75Price * 1.05) : null;
  const recommendedListPrice = p75Price != null ? Math.round(p75Price * 1.02) : null;

  return (
    <div className={`${ANALYZE_CARD} flex h-full flex-col p-6`}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
          <svg
            className="h-3.5 w-3.5 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div>
          <p className={`${CARD_LABEL} text-emerald-600`}>Prodáváte?</p>
          <p className="mt-0.5 text-[11px] text-slate-400">strategie a inzertní cena</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 px-2.5 py-2.5 text-center opacity-70">
          <p className="text-[10px] leading-tight text-slate-400">
            Rychlý
            <br />
            prodej
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-slate-700">
            {quickSalePrice != null ? `${Math.round(quickSalePrice / 1000)}k` : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">do 7 dní</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2.5 text-center">
          <p className="text-[10px] font-medium leading-tight text-emerald-500">Doporučeno</p>
          <p className="mt-1.5 text-[13px] font-semibold text-emerald-700">
            {normalPrice != null ? `${Math.round(normalPrice / 1000)}k` : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-400">do 30 dní</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2.5 py-2.5 text-center opacity-70">
          <p className="text-[10px] leading-tight text-slate-400">
            Max
            <br />
            zisk
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-slate-700">
            {maxPrice != null ? `${Math.round(maxPrice / 1000)}k` : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">čekám na kupce</p>
        </div>
      </div>

      <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-slate-500">
          {sampleSize != null && sampleSize >= 30 ? (
            <>
              Na trhu je aktuálně{" "}
              <strong className="font-semibold text-slate-700">{sampleSize} konkurentů</strong>.
              Inzerujte za{" "}
              <strong className="font-semibold text-slate-700">
                {recommendedListPrice != null
                  ? `${recommendedListPrice.toLocaleString("cs-CZ")} Kč`
                  : "—"}
              </strong>{" "}
              — máte prostor slevit a stále být nad mediánem.
            </>
          ) : (
            <>
              Řídký trh s{" "}
              <strong className="font-semibold text-slate-700">
                {sampleSize != null ? sampleSize : "—"} inzeráty
              </strong>{" "}
              — méně konkurence, inzerujte odvážněji nad mediánem.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
