"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart";

type DistributionPoint = {
  bucket: string;
  cheap: number;
  fair: number;
  overpriced: number;
};

const MOCK_DATA: DistributionPoint[] = [
  { bucket: "Celý trh", cheap: 21, fair: 56, overpriced: 23 },
];

export function PriceDistributionChart() {
  return (
    <div className="group col-span-1 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:border-blue-400/60 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Price distribution
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Rozdělení inzerovaných cen do tří pásem.
          </p>
        </div>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
          Medián zvýrazněn v deal score
        </span>
      </div>

      <SafeResponsiveChart className="mt-4 h-44 w-full min-h-[176px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MOCK_DATA} margin={{ top: 8, left: -20, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="bucket"
              tick={{ fill: "#6B7280", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#6B7280", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, 100]}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              wrapperStyle={{ outline: "none" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const entry = payload[0].payload as DistributionPoint;
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs text-slate-50 shadow-xl">
                    <p className="text-[11px] font-medium text-slate-200">
                      {entry.bucket}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-300">
                      Levné: {entry.cheap} %
                    </p>
                    <p className="text-[11px] text-blue-300">
                      Férové: {entry.fair} %
                    </p>
                    <p className="text-[11px] text-rose-300">
                      Nadhodnocené: {entry.overpriced} %
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="cheap"
              stackId="price"
              fill="#22C55E"
              radius={[999, 0, 0, 999]}
            />
            <Bar dataKey="fair" stackId="price" fill="#5B8CFF" />
            <Bar
              dataKey="overpriced"
              stackId="price"
              fill="#F97373"
              radius={[0, 999, 999, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </SafeResponsiveChart>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            <span>Levné</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#5B8CFF]" />
            <span>Férové</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#F97373]" />
            <span>Nadhodnocené</span>
          </div>
        </div>
        <span className="hidden rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 sm:inline">
          Na základě posledních 30 dní
        </span>
      </div>
    </div>
  );
}

