"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EmotionStackedArea from "@/components/charts/EmotionStackedArea";
import { getDocuments, getLatestInference } from "@/lib/api";

type Point = { day: string; [emotion: string]: string | number };

export default function OrgDashboard({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    localStorage.setItem("eadss_active_org", orgId);

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const since = new Date();
        since.setDate(since.getDate() - 14);
        const docsRes = await getDocuments({
          org_id: orgId,
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
          for (const emo of labels) byDay[day][emo] = Number(byDay[day][emo] ?? 0) + 1;
        }

        const next = Object.values(byDay).sort((a, b) => String(a.day).localeCompare(String(b.day))) as Point[];
        if (!cancelled) setPoints(next);
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
  }, [orgId]);

  const totalEvents = useMemo(
    () =>
      points.reduce(
        (sum, p) => sum + Object.entries(p).filter(([k]) => k !== "day").reduce((n, [, v]) => n + Number(v ?? 0), 0),
        0
      ),
    [points]
  );

  return (
    <main className="app-shell stack">
      <section className="page-header">
        <div>
          <h1 className="page-title">Organization Dashboard</h1>
          <p className="page-subtitle">Org: {orgId}</p>
        </div>
        <div className="nav-inline">
          <Link className="button-muted" href={`/org/${orgId}/usage`}>
            Usage
          </Link>
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
          <div className="kpi-label">Events (14d)</div>
          <div className="kpi-value">{totalEvents}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Days with Activity</div>
          <div className="kpi-value">{points.length}</div>
        </article>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Emotion Trends</h2>
          <span className="meta">{loading ? "Refreshing..." : "Updated"}</span>
        </div>
        <EmotionStackedArea data={points} />
      </section>
    </main>
  );
}
