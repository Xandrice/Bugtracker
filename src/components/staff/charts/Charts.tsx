"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#3b82f6",
  "#f97316",
  "#84cc16",
];

const AXIS_TICK = { fontSize: 11, fill: "currentColor" } as const;

const tooltipStyle = {
  backgroundColor: "var(--color-surface, #1a1a1a)",
  border: "1px solid var(--color-border, #333)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-foreground, #fff)",
};

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}

export function HorizontalBarPanel({
  data,
  color = CHART_COLORS[0],
  height = 280,
  emptyLabel = "No data available.",
}: {
  data: { name: string; count: number }[];
  color?: string;
  height?: number;
  emptyLabel?: string;
}) {
  if (!data.length) return <EmptyState label={emptyLabel} />;
  return (
    <div className="text-muted-foreground" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeOpacity={0.12} />
          <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            width={110}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.06 }} />
          <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VerticalBarPanel({
  data,
  xKey,
  color = CHART_COLORS[0],
  height = 280,
  emptyLabel = "No data available.",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  color?: string;
  height?: number;
  emptyLabel?: string;
}) {
  if (!data.length) return <EmptyState label={emptyLabel} />;
  return (
    <div className="text-muted-foreground" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.12} />
          <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.06 }} />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutPanel({
  data,
  height = 280,
  emptyLabel = "No data available.",
}: {
  data: { name: string; value: number }[];
  height?: number;
  emptyLabel?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <EmptyState label={emptyLabel} />;
  return (
    <div className="text-muted-foreground" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaTrendPanel({
  data,
  xKey,
  series,
  height = 280,
  emptyLabel = "No history captured yet.",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
  emptyLabel?: string;
}) {
  if (data.length < 2) return <EmptyState label={emptyLabel} />;
  return (
    <div className="text-muted-foreground" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.12} />
          <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              fill={`url(#grad-${s.key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
