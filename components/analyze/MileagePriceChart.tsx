"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SafeResponsiveChart } from "@/components/charts/SafeResponsiveChart";

type MileagePoint = {
  mileage: string;
  price: number;
};

const MOCK_POINTS: MileagePoint[] = [
  { mileage: "0–50k", price: 420000 },
  { mileage: "50–100k", price: 385000 },
  { mileage: "100–150k", price: 355000 },
  { mileage: "150–200k", price: 325000 },
  { mileage: "200k+", price: 295000 },
];

export function MileagePriceChart() {
  return (
    <div className="group col-span-1 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:border-blue-400/60 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Mileage vs. price
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Jak klesá průměrná tržní cena s nájezdem.
          </p>
        </div>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
          Smoothed curve
        </span>
      </div>

      <SafeResponsiveChart className="mt-4 h-52 w-full min-h-[208px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={MOCK_POINTS}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="mileageArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5B8CFF" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#5B8CFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#E5E7EB"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="mileage"
              tick={{ fill: "#6B7280", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#6B7280", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
            />
            <Tooltip
              wrapperStyle={{ outline: "none" }}
              contentStyle={{
                backgroundColor: "#020617",
                borderRadius: 12,
                border: "1px solid #0f172a",
                padding: "8px 10px",
              }}
              labelStyle={{ color: "#cbd5f5", fontSize: 11 }}
              formatter={(value) => [
                `${Number(value ?? 0).toLocaleString("cs-CZ")} Kč`,
                "Medián",
              ]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#5B8CFF"
              strokeWidth={2}
              fill="url(#mileageArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </SafeResponsiveChart>

      <p className="mt-3 text-[11px] text-slate-600">
        Typický pokles hodnoty je plynulý, bez tvrdých zlomů – to pomáhá odhalit
        podezřele levné nebo drahé inzeráty.
      </p>
    </div>
  );
}

