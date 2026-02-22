"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EmotionStackedArea from "@/components/charts/EmotionStackedArea";
import { getDocuments, getLatestInference } from "@/lib/api";

type Point = { day: string; [emotion: string]: string | number };

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const since = new Date();
        since.setDate(since.getDate() - 14);

        const docsRes = await getDocuments({
          org_id: "demo",
          limit: 200,
          offset: 0,
          since: since.toISOString(),
          until: new Date().toISOString(),
        });

        const pairs = await Promise.all(
          docsRes.items.map(async (d) => {
            const inf = await getLatestInference(d.id);
            return { doc: d, inf: inf.latest };
          })
        );

        const byDay: Record<string, Point> = {};

        for (const p of pairs) {
          const ts = p.doc.timestamp ?? p.doc.created_at;
          const day = String(ts).slice(0, 10);
          const labels: string[] = p.inf?.emotion_labels?.length ? p.inf.emotion_labels : ["no_inference"];

          byDay[day] ??= { day };
          for (const emo of labels) {
            byDay[day][emo] = Number(byDay[day][emo] ?? 0) + 1;
          }
        }

        const nextPoints = Object.values(byDay).sort((a, b) => String(a.day).localeCompare(String(b.day))) as Point[];

        if (!cancelled) setPoints(nextPoints);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <section className="page-header">
        <div>
          <h1 className="page-title">Demo Dashboard</h1>
          <p className="page-subtitle">14-day emotion volume trend for sample organization `demo`.</p>
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

      {error && <div className="error">{error}</div>}

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Emotion Trends</h2>
          <span className="meta">{loading ? "Refreshing data..." : "Live from API"}</span>
        </div>
        <EmotionStackedArea data={points} />
      </section>
    </main>
  );
}
