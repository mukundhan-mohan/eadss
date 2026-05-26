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

const chartPalette = ["#00c2a8", "#ff8c42", "#f95d6a", "#7cc6fe", "#ffd166", "#7d8ca3"];

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
        const val = Number(v ?? 0);
        emotions.add(k);
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
      <section className="control-hero">
        <div className="control-hero-copy">
          <span className="hero-kicker">Public signal room</span>
          <h1 className="page-title">See how emotional pressure becomes operational insight.</h1>
          <p className="page-subtitle">
            This is a public product demo using curated sample data to show the charting, evidence tone, and decision
            posture of EADSS.
          </p>
        </div>
        <div className="control-hero-actions">
          <Link className="button-secondary" href="/alerts">
            Explore Alerts
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
          <div className="kpi-label">Loaded days</div>
          <div className="kpi-value">{insights.days}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Total inferred events</div>
          <div className="kpi-value">{insights.docs}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Signal families</div>
          <div className="kpi-value">{insights.emotions}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Average daily volume</div>
          <div className="kpi-value">{insights.avgDailyLoad}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Peak day</div>
          <div className="kpi-value">{insights.peakDay?.day ?? "-"}</div>
        </article>
        <article className="kpi-card kpi-card-alert">
          <div className="kpi-label">Pressure index</div>
          <div className="kpi-value">{insights.riskIndex}%</div>
        </article>
      </section>

      <div className="panel-soft">
        Public demo only. The real product adds authenticated ingestion, human review queues, and evidence-linked
        workflow actions on top of these signals.
      </div>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Trend surface</span>
            <h2 className="feature-title">Emotion volume over time</h2>
          </div>
          <span className="meta">Sample dataset • 14-day window</span>
        </div>
        <EmotionStackedArea data={points} />
      </section>

      <section className="dashboard-grid">
        <article className="panel stack">
          <div className="split">
            <h2 className="feature-title">Emotion mix</h2>
            <span className="meta">Distribution by signal family</span>
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
            <h2 className="feature-title">Pressure vs recovery</h2>
            <span className="meta">Daily emotional load balance</span>
          </div>
          <div className="chart-wrap-sm">
            <ResponsiveContainer>
              <LineChart data={insights.workloadTrend} margin={{ top: 12, right: 14, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#264a62" />
                <XAxis dataKey="day" tick={{ fill: "#9bb7ca", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9bb7ca", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="pressure" stroke="#ff8c42" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="recovery" stroke="#00c2a8" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel stack">
          <div className="split">
            <h2 className="feature-title">Weekday clustering</h2>
            <span className="meta">Where service load tends to accumulate</span>
          </div>
          <div className="chart-wrap-sm">
            <ResponsiveContainer>
              <BarChart data={insights.weeklyPattern} margin={{ top: 12, right: 14, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#264a62" />
                <XAxis dataKey="dayLabel" tick={{ fill: "#9bb7ca", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9bb7ca", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pressure" fill="#7cc6fe" radius={[6, 6, 0, 0]} />
                <Bar dataKey="positive" fill="#00c2a8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel stack">
          <div className="split">
            <h2 className="feature-title">Signal profile</h2>
            <span className="meta">Composite operational posture</span>
          </div>
          <div className="chart-wrap-sm">
            <ResponsiveContainer>
              <RadarChart data={insights.teamSignalProfile}>
                <PolarGrid stroke="#355971" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#9bb7ca", fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: "#6b8aa0", fontSize: 10 }} />
                <Radar dataKey="value" stroke="#7cc6fe" fill="#7cc6fe" fillOpacity={0.34} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </main>
  );
}
