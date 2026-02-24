"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmotionStackedArea from "@/components/charts/EmotionStackedArea";

type Point = { day: string; [emotion: string]: string | number };

const samplePoints: Point[] = [
  { day: "2026-02-10", anger: 4, anxiety: 6, joy: 3, neutral: 8 },
  { day: "2026-02-11", anger: 3, anxiety: 5, joy: 4, neutral: 9 },
  { day: "2026-02-12", anger: 5, anxiety: 7, joy: 2, neutral: 8 },
  { day: "2026-02-13", anger: 7, anxiety: 8, joy: 2, neutral: 7 },
  { day: "2026-02-14", anger: 6, anxiety: 6, joy: 3, neutral: 8 },
  { day: "2026-02-15", anger: 4, anxiety: 5, joy: 5, neutral: 10 },
  { day: "2026-02-16", anger: 3, anxiety: 4, joy: 6, neutral: 11 },
  { day: "2026-02-17", anger: 2, anxiety: 4, joy: 7, neutral: 11 },
  { day: "2026-02-18", anger: 3, anxiety: 5, joy: 6, neutral: 10 },
  { day: "2026-02-19", anger: 5, anxiety: 7, joy: 4, neutral: 9 },
  { day: "2026-02-20", anger: 6, anxiety: 8, joy: 3, neutral: 8 },
  { day: "2026-02-21", anger: 4, anxiety: 6, joy: 5, neutral: 9 },
  { day: "2026-02-22", anger: 3, anxiety: 4, joy: 7, neutral: 10 },
  { day: "2026-02-23", anger: 2, anxiety: 3, joy: 8, neutral: 11 },
];

const chartPalette = ["#0f6fa8", "#d05a1e", "#18794e", "#5e6f82", "#8c5228", "#5a87ab"];

export default function DashboardPage() {
  const points = samplePoints;

  const insights = useMemo(() => {
    const days = points.length;
    let docs = 0;
    const emotions = new Set<string>();
    const emotionTotals: Record<string, number> = {};
    const workloadTrend: Array<{ day: string; total: number; pressure: number; recovery: number }> = [];
    const weeklyMap: Record<string, { dayLabel: string; pressure: number; positive: number; volume: number }> = {};

    for (const p of points) {
      const anger = Number(p.anger ?? 0);
      const anxiety = Number(p.anxiety ?? 0);
      const joy = Number(p.joy ?? 0);
      const neutral = Number(p.neutral ?? 0);
      const total = anger + anxiety + joy + neutral;
      const pressure = anger + anxiety;
      const recovery = joy + neutral;

      workloadTrend.push({ day: String(p.day), total, pressure, recovery });

      const dayLabel = new Date(`${p.day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short" });
      weeklyMap[dayLabel] ??= { dayLabel, pressure: 0, positive: 0, volume: 0 };
      weeklyMap[dayLabel].pressure += pressure;
      weeklyMap[dayLabel].positive += joy;
      weeklyMap[dayLabel].volume += total;

      for (const [k, v] of Object.entries(p)) {
        if (k === "day") continue;
        emotions.add(k);
        const val = Number(v ?? 0);
        docs += val;
        emotionTotals[k] = (emotionTotals[k] ?? 0) + val;
      }
    }

    const emotionMix = Object.entries(emotionTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const avgDailyLoad = Math.round(docs / Math.max(1, days));
    const peakDay = workloadTrend.reduce((prev, cur) => (cur.total > prev.total ? cur : prev), workloadTrend[0]);
    const riskIndex = Math.round((workloadTrend.reduce((sum, row) => sum + row.pressure, 0) / Math.max(1, docs)) * 100);
    const weeklyPattern = Object.values(weeklyMap);
    const teamSignalProfile = [
      { metric: "Support Stress", value: Math.round((emotionTotals.anger ?? 0) * 1.7 + (emotionTotals.anxiety ?? 0)) },
      { metric: "Customer Recovery", value: Math.round((emotionTotals.joy ?? 0) * 1.8 + (emotionTotals.neutral ?? 0) * 0.7) },
      { metric: "Escalation Risk", value: Math.round(((emotionTotals.anger ?? 0) + (emotionTotals.anxiety ?? 0)) * 1.5) },
      { metric: "Signal Stability", value: Math.max(10, 120 - Math.round(((emotionTotals.anger ?? 0) + (emotionTotals.anxiety ?? 0)) * 2.1)) },
      { metric: "Service Confidence", value: Math.round((emotionTotals.joy ?? 0) * 1.2 + (emotionTotals.neutral ?? 0)) },
    ];

    return {
      days,
      docs,
      emotions: emotions.size,
      emotionMix,
      workloadTrend,
      weeklyPattern,
      teamSignalProfile,
      avgDailyLoad,
      peakDay,
      riskIndex,
    };
  }, [points]);

  return (
    <main className="app-shell stack">
      <section className="demo-header stack">
        <div className="announce-ribbon">Public AI product demo</div>
        <p className="meta">
          This dashboard is intentionally public and uses curated sample data for showcasing EADSS AI decision intelligence.
        </p>
      </section>

      <section className="page-header">
        <div>
          <h1 className="page-title">Demo Dashboard</h1>
          <p className="page-subtitle">Public sample data for a 14-day emotion trend demo.</p>
        </div>
        <div className="nav-inline">
          <Link className="button-muted" href="/alerts">
            Alerts
          </Link>
          <Link className="button-muted" href="/register">
            Register Org
          </Link>
          <Link className="button-muted" href="/">
            Home
          </Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-label">Loaded Days</div>
          <div className="kpi-value">{insights.days}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Total Inferred Events</div>
          <div className="kpi-value">{insights.docs}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Emotion Categories</div>
          <div className="kpi-value">{insights.emotions}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Avg Daily Volume</div>
          <div className="kpi-value">{insights.avgDailyLoad}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Peak Day</div>
          <div className="kpi-value">{insights.peakDay?.day ?? "-"}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Pressure Index</div>
          <div className="kpi-value">{insights.riskIndex}%</div>
        </article>
      </section>

      <div className="panel-soft">
        This page uses sample public data for AI product demonstration. No login or API key required.
      </div>

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Emotion Trends</h2>
          <span className="meta">Sample dataset</span>
        </div>
        <EmotionStackedArea data={points} />
      </section>

      <section className="dashboard-grid">
        <article className="panel stack">
          <div className="split">
            <h2 className="feature-title">Emotion Mix Distribution</h2>
            <span className="meta">Share of signal by emotion</span>
          </div>
          <div className="chart-wrap-sm">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={insights.emotionMix} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2}>
                  {insights.emotionMix.map((entry, idx) => (
                    <Cell key={entry.name} fill={chartPalette[idx % chartPalette.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel stack">
          <div className="split">
            <h2 className="feature-title">Operational Pressure vs Recovery</h2>
            <span className="meta">Daily emotional load balance</span>
          </div>
          <div className="chart-wrap-sm">
            <ResponsiveContainer>
              <LineChart data={insights.workloadTrend} margin={{ top: 12, right: 14, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#d8e7f2" />
                <XAxis dataKey="day" tick={{ fill: "#48657a", fontSize: 12 }} />
                <YAxis tick={{ fill: "#48657a", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="pressure" stroke="#d05a1e" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="recovery" stroke="#18794e" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel stack">
          <div className="split">
            <h2 className="feature-title">Weekday Signal Pattern</h2>
            <span className="meta">Where load tends to cluster</span>
          </div>
          <div className="chart-wrap-sm">
            <ResponsiveContainer>
              <BarChart data={insights.weeklyPattern} margin={{ top: 12, right: 14, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#d8e7f2" />
                <XAxis dataKey="dayLabel" tick={{ fill: "#48657a", fontSize: 12 }} />
                <YAxis tick={{ fill: "#48657a", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pressure" fill="#0f6fa8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="positive" fill="#18794e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel stack">
          <div className="split">
            <h2 className="feature-title">Team Signal Profile</h2>
            <span className="meta">Composite KPI model (demo)</span>
          </div>
          <div className="chart-wrap-sm">
            <ResponsiveContainer>
              <RadarChart data={insights.teamSignalProfile}>
                <PolarGrid stroke="#c6dbeb" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#48657a", fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: "#6b8193", fontSize: 10 }} />
                <Radar dataKey="value" stroke="#0f6fa8" fill="#0f6fa8" fillOpacity={0.36} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </main>
  );
}
