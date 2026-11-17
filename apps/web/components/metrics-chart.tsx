"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = { t: string; cpu: number; mem: number; disk: number };

const axisTick = { fill: "#64748b", fontSize: 11 };

export function MetricsChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-60 place-items-center text-sm text-slate-500">
        Chưa có dữ liệu telemetry
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="fillCpu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillMem" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillDisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            contentStyle={{
              background: "#0b1220",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" />
          <Area
            type="monotone"
            dataKey="cpu"
            name="CPU %"
            stroke="#22d3ee"
            fill="url(#fillCpu)"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="mem"
            name="RAM %"
            stroke="#a78bfa"
            fill="url(#fillMem)"
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="disk"
            name="Ổ C: %"
            stroke="#fbbf24"
            fill="url(#fillDisk)"
            strokeWidth={1.4}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
