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

const palette = ["#0f6fa8", "#d05a1e", "#18794e", "#8c5228", "#5a87ab", "#5e6f82"];

export default function EmotionStackedArea({ data = [] }: Props) {
  const keys = Array.from(new Set((data ?? []).flatMap((d) => Object.keys(d).filter((k) => k !== "day"))));

  if (!data.length) {
    return <div className="empty">No data available yet.</div>;
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 6 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#d8e7f2" />
          <XAxis dataKey="day" tick={{ fill: "#48657a", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#b7ccdd" }} />
          <YAxis allowDecimals={false} tick={{ fill: "#48657a", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#b7ccdd" }} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #c7dbeb", boxShadow: "0 8px 20px rgba(26, 61, 92, 0.1)" }} />
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
