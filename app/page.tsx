"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AdvancedSearchSection } from "@/components/AdvancedSearchSection";

export default function HomePage() {
  const MODELS = [
    {
      label: "Škoda Octavia",
      example: "Škoda Octavia 2.0 TDI 2019...",
      modelKey: "skoda_octavia",
      median: 299000,
      p25: 219999,
      p75: 389000,
      min: 189999,
      max: 489000,
      sample: 63,
      avgMileage: 157,
    },
    {
      label: "Volkswagen Golf",
      example: "Volkswagen Golf 1.6 TDI 2018...",
      modelKey: "volkswagen_golf",
      median: 320000,
      p25: 220000,
      p75: 452000,
      min: 150000,
      max: 600000,
      sample: 117,
      avgMileage: 136,
    },
    {
      label: "Ford Focus",
      example: "Ford Focus 1.5 EcoBlue 2017...",
      modelKey: "ford_focus",
      median: 104500,
      p25: 57250,
      p75: 271500,
      min: 30000,
      max: 350000,
      sample: 52,
      avgMileage: 180,
    },
    {
      label: "BMW 3er",
      example: "BMW 320d 2018...",
      modelKey: "bmw_3er",
      median: 249900,
      p25: 130000,
      p75: 324450,
      min: 80000,
      max: 450000,
      sample: 19,
      avgMileage: 182,
    },
  ];

  const [typewriterText, setTypewriterText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);

  const currentModel = MODELS[0]!;

  useEffect(() => {
    if (animationDone) {
      return;
    }
    const target = currentModel.example;
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        const next = target.slice(0, typewriterText.length + 1);
        setTypewriterText(next);
        if (next.length === target.length) {
          setCardsVisible(true);
          setAnimationDone(true);
        }
      } else {
        const next = target.slice(0, typewriterText.length - 1);
        setTypewriterText(next);
      }
    }, isDeleting ? 20 : 40);
    return () => clearTimeout(timeout);
  }, [typewriterText, isDeleting, currentModel.example, animationDone]);

  const m = currentModel;
  const suggestedOffer = Math.round((m.median + m.p25) / 2);
  const negotiationRoom = Math.round(((m.median - suggestedOffer) / m.median) * 100);
  const quickSale = Math.round(m.p25 * 0.97);
  const maxSale = m.p75;
  const grossMargin = m.median - m.p25;
  const roi = Math.round((grossMargin / m.p25) * 100);
  const flipScore = Math.min(
    10,
    Math.round((grossMargin / 20000) * 0.6 + (m.sample / 15) * 0.4),
  );

  return (
    <div className="relative min-h-screen bg-white overflow-x-hidden">

      {/* Gradient hero pozadí */}
      <section
        className="relative overflow-hidden pt-14"
        style={{
          background: "linear-gradient(160deg, #dbeafe 0%, #eff6ff 30%, #f0f9ff 60%, #ecfdf5 100%)",
          minHeight: "660px",
        }}
      >
        {/* Radiální kruhy */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute top-[-100px] left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(147,197,253,0.5) 0%, transparent 65%)" }}
          />
          <div
            className="absolute top-[100px] -right-24 h-[400px] w-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(196,181,253,0.3) 0%, transparent 65%)" }}
          />
          <div
            className="absolute -bottom-12 -left-12 h-[350px] w-[350px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(167,243,208,0.3) 0%, transparent 65%)" }}
          />
        </div>

        {/* Text */}
        <div className="relative z-10 flex flex-col items-center pt-14 px-4 text-center">
          <h1 className="text-[60px] font-extrabold tracking-[-2px] leading-[1.05] text-slate-900 mb-4">
            Odhalte skutečnou cenu
            <br />
            <span className="text-blue-600">jakéhokoliv</span> ojetého auta
          </h1>

          <p className="text-[15px] text-slate-500 max-w-[420px] leading-relaxed mb-4">
            Reálné ceny očištěné o extrémy. Zjistěte férovou hodnotu vozu a získejte taktickou výhodu pro nákup, prodej i flipování.
          </p>

          <div className="mt-4 w-full max-w-5xl">
            <AdvancedSearchSection />
          </div>

          <p className="mt-20 sm:mt-28 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 mb-8">
            Ukázka výsledku analýzy
          </p>
        </div>

        {/* Floating zone */}
        <div className="relative mx-auto mt-0 max-w-5xl px-4" style={{ height: "380px" }}>
          {/* Centrální karta — věrná /analyze stránce */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={cardsVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 150, damping: 20 }}
            className="absolute left-1/2 top-0 z-10 -translate-x-1/2 overflow-hidden rounded-[20px] border border-black/[0.07] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
            style={{ width: "420px" }}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Férová cena segmentu
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-700">
                    {m.sample} inzerátů
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[42px] font-extrabold leading-none tracking-[-1.5px] text-slate-900">
                {cardsVisible ? m.median.toLocaleString("cs-CZ") + " Kč" : " "}
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <svg
                  className="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Férová cena
              </div>
            </div>

            {/* Gauge */}
            <div className="px-6 pb-4">
              <div className="flex h-[5px] overflow-hidden rounded-full">
                <div className="flex-1 bg-emerald-200" />
                <div className="flex-1 bg-blue-200" />
                <div className="flex-1 bg-red-200" />
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] text-slate-400">
                <span>{Math.round(m.p25 / 1000)} tis. · levné</span>
                <span className="font-bold text-blue-600">
                  {Math.round(m.median / 1000)} tis.
                </span>
                <span>{Math.round(m.p75 / 1000)} tis. · vysoké</span>
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50">
              <div className="px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Levnější 25 %
                </p>
                <p className="mt-1 text-[13px] font-extrabold text-slate-800">
                  {Math.round(m.p25 / 1000)}k Kč
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Průměrný nájezd
                </p>
                <p className="mt-1 text-[13px] font-extrabold text-slate-800">
                  {m.avgMileage} tis. km
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Dražší 25 %
                </p>
                <p className="mt-1 text-[13px] font-extrabold text-slate-800">
                  {Math.round(m.p75 / 1000)}k Kč
                </p>
              </div>
            </div>
          </motion.div>

          {/* Kupujete — vlevo nahoře */}
          <AnimatePresence>
            {cardsVisible && (
              <motion.div
                key="card-buyer"
                initial={{ opacity: 0, x: -60, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: -40, y: 10 }}
                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                className="absolute z-5 rounded-[18px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.10)]"
                style={{ left: "1%", top: "15px", width: "220px", rotate: "-4deg" }}
              >
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-blue-700">
                  Kupujete?
                </p>
                <p className="mb-1 text-[11px] text-slate-400">Doporučená nabídka</p>
                <p className="text-[24px] font-extrabold text-blue-600 tracking-tight leading-none">
                  {suggestedOffer.toLocaleString("cs-CZ")} Kč
                </p>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  −{negotiationRoom} % pod mediánem
                </p>
                <div className="mt-2.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700">
                  Prostor pro slevu: střední
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prodáváte — vlevo dole */}
          <AnimatePresence>
            {cardsVisible && (
              <motion.div
                key="card-seller"
                initial={{ opacity: 0, x: -60, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: -40, y: -10 }}
                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                className="absolute z-5 rounded-[18px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.10)]"
                style={{ left: "0%", top: "215px", width: "220px", rotate: "3.5deg" }}
              >
                <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">
                  Prodáváte?
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg bg-slate-50 py-2.5 text-center opacity-60">
                    <p className="text-[9px] text-slate-400 leading-tight">Rychle</p>
                    <p className="mt-0.5 text-[15px] font-extrabold text-slate-700">
                      {Math.round(quickSale / 1000)}k
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 py-2.5 text-center">
                    <p className="text-[9px] font-bold text-emerald-600 leading-tight">
                      Ideál
                    </p>
                    <p className="mt-0.5 text-[15px] font-extrabold text-emerald-800">
                      {Math.round(m.median / 1000)}k
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2.5 text-center opacity-60">
                    <p className="text-[9px] text-slate-400 leading-tight">Max</p>
                    <p className="mt-0.5 text-[15px] font-extrabold text-slate-700">
                      {Math.round(maxSale / 1000)}k
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flipujete — vpravo nahoře */}
          <AnimatePresence>
            {cardsVisible && (
              <motion.div
                key="card-flipper"
                initial={{ opacity: 0, x: 60, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 40, y: 10 }}
                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.15 }}
                className="absolute z-5 rounded-[18px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.10)]"
                style={{ right: "1%", top: "15px", width: "215px", rotate: "4deg" }}
              >
                <p className="relative mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-orange-700">
                  Flipujete?
                  <span className="absolute -top-0.5 right-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                    PRO
                  </span>
                </p>
                <div className="mb-2.5 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400">Marže</p>
                    <p className="mt-0.5 text-[28px] font-extrabold leading-none tracking-tight text-emerald-600">
                      {Math.round(grossMargin / 1000)}k
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">ROI</p>
                    <p className="mt-0.5 text-[28px] font-extrabold leading-none tracking-tight text-emerald-600">
                      {roi}%
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">
                  Flip skóre {flipScore} / 10
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trh — vpravo dole */}
          <AnimatePresence>
            {cardsVisible && (
              <motion.div
                key="card-market"
                initial={{ opacity: 0, x: 60, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 40, y: -10 }}
                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.25 }}
                className="absolute z-5 rounded-[18px] border border-black/[0.07] bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.10)]"
                style={{ right: "0%", top: "215px", width: "212px", rotate: "-3.5deg" }}
              >
                <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                  Trh dnes
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] text-slate-500">Modelů</span>
                    <span className="text-[14px] font-extrabold text-slate-900">
                      240+
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] text-slate-500">Portálů</span>
                    <span className="text-[14px] font-extrabold text-slate-900">
                      4
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-500">Aktualizace</span>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      <span className="text-[12px] font-extrabold text-slate-900">
                        Dnes
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Metodika */}
      <section className="px-4 pb-16 border-t border-slate-100 pt-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Metodika</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Jak počítáme férovou cenu</h2>
            <p className="text-sm text-slate-500 mt-2">Robustní statistika, český trh. Transparentní a reprodukovatelné.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { num: "1.", title: "Sbíráme inzeráty", desc: "Data z portálů, normalizované modely." },
              { num: "2.", title: "Čistíme odlehlé hodnoty", desc: "Podezřelé ceny, duplicity, chyby." },
              { num: "3.", title: "Počítáme statistiky", desc: "Medián, percentily, vážení, trendy." },
              { num: "4.", title: "Férové pásmo", desc: "Cena a rozptyl dle trhu." },
            ].map((s) => (
              <div key={s.num} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <p className="text-lg font-bold text-blue-600 mb-2">{s.num}</p>
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

