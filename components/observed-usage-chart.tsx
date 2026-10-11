"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageForecastWindow } from "@/lib/usage/types";

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo" }).format(new Date(timestamp));
}

export function ObservedUsageChart({ window, sampledAt }: { window: UsageForecastWindow; sampledAt: number }) {
  const samples = window.samples.filter((sample) => sample.resetsAt === window.resetsAt && sample.sampledAt >= sampledAt - 3_600_000 && sample.sampledAt <= sampledAt);
  const points = new Map(samples.map((sample) => [sample.sampledAt, sample.usedPercent]));
  const usedPercent = Math.max(0, Math.min(100, 100 - window.remainingPercent));
  points.set(sampledAt, usedPercent);
  const data = [...points].sort(([a], [b]) => a - b).map(([timestamp, value]) => ({ sampledAt: timestamp, usedPercent: Math.max(0, Math.min(100, value)) }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{window.label}</h3>
        <p className="text-sm tabular-nums">現在の使用率 {usedPercent}%</p>
      </div>
      <div role="img" aria-label={`${window.label}の使用率推移`} className="h-56 w-full md:h-64">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 224 }}>
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="sampledAt" type="number" scale="time" domain={[sampledAt - 3_600_000, sampledAt]} tickFormatter={formatClock} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value: number) => `${value}%`} width={42} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Tooltip labelFormatter={(value) => formatClock(Number(value))} formatter={(value) => [`${Number(value)}%`, "使用率"]} contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)" }} />
            <Line type="stepAfter" dataKey="usedPercent" name="使用率" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {data.length < 2 ? <p className="text-xs text-muted-foreground">観測データを収集中です。次の記録が集まると推移を表示します。</p> : null}
    </div>
  );
}
