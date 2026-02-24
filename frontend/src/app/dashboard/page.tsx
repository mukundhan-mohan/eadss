"use client";

import { useMemo } from "react";
import Link from "next/link";
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

export default function DashboardPage() {
  const points = samplePoints;

  const totals = useMemo(() => {
    const days = points.length;
    let docs = 0;
    const emotions = new Set<string>();

    for (const p of points) {
      for (const [k, v] of Object.entries(p)) {
        if (k === "day") continue;
        emotions.add(k);
        docs += Number(v ?? 0);
      }
    }

    return { days, docs, emotions: emotions.size };
  }, [points]);

  return (
    <main className="app-shell stack">
      <section className="demo-header stack">
        <div className="announce-ribbon">Public product demo</div>
        <p className="meta">
          This dashboard is intentionally public and uses curated sample data for showcasing the EADSS platform.
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
          <div className="kpi-value">{totals.days}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Total Inferred Events</div>
          <div className="kpi-value">{totals.docs}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Emotion Categories</div>
          <div className="kpi-value">{totals.emotions}</div>
        </article>
      </section>

      <div className="panel-soft">
        This page uses sample public data for product demonstration. No login or API key required.
      </div>

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Emotion Trends</h2>
          <span className="meta">Sample dataset</span>
        </div>
        <EmotionStackedArea data={points} />
      </section>
    </main>
  );
}
