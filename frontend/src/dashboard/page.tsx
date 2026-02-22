"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EmotionStackedArea from "@/components/charts/EmotionStackedArea";
import { getDocuments, getLatestInference } from "@/lib/api";

type Point = { day: string; [emotion: string]: string | number };

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const since = new Date();
        since.setDate(since.getDate() - 14);

        const res = await getDocuments({
          org_id: "demo",
          limit: 200,
          offset: 0,
          since: since.toISOString(),
          until: new Date().toISOString(),
        });

        const pairs = await Promise.all(
          res.items.map(async (d) => {
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

        const points = Object.values(byDay).sort((a, b) => String(a.day).localeCompare(String(b.day))) as Point[];

        if (!cancelled) setData(points);
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

  const eventCount = useMemo(
    () => data.reduce((sum, row) => sum + Object.entries(row).filter(([k]) => k !== "day").reduce((n, [, v]) => n + Number(v ?? 0), 0), 0),
    [data]
  );

  return (
    <main className="app-shell stack">
      <section className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Standalone dashboard route</p>
        </div>
        <div className="nav-inline">
          <Link className="button-muted" href="/alerts">
            Alerts
          </Link>
          <Link className="button-muted" href="/">
            Home
          </Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-label">Loaded Days</div>
          <div className="kpi-value">{data.length}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Event Count</div>
          <div className="kpi-value">{eventCount}</div>
        </article>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Emotion Trends</h2>
          <span className="meta">{loading ? "Loading..." : "Updated"}</span>
        </div>
        <EmotionStackedArea data={data} />
      </section>
    </main>
  );
}
