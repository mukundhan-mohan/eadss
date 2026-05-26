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

type Props = { data?: Array<Record<string, any>> };

const palette = ["#7cc6fe", "#ff8c42", "#00c2a8", "#f95d6a", "#ffd166", "#8ba4ba"];

export default function EmotionStackedArea({ data = [] }: Props) {
  const keys = Array.from(new Set((data ?? []).flatMap((d) => Object.keys(d).filter((k) => k !== "day"))));

  if (!data.length) {
    return <div className="empty">No data available yet.</div>;
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 6 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#264a62" />
          <XAxis dataKey="day" tick={{ fill: "#9bb7ca", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#355971" }} />
          <YAxis allowDecimals={false} tick={{ fill: "#9bb7ca", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#355971" }} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(124, 198, 254, 0.22)",
              background: "rgba(8, 16, 27, 0.94)",
              color: "#edf4fb",
              boxShadow: "0 18px 28px rgba(2, 8, 18, 0.36)",
            }}
          />
          <Legend />
          {keys.map((k, idx) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stackId="1"
              stroke={palette[idx % palette.length]}
              fill={palette[idx % palette.length]}
              fillOpacity={0.78}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
