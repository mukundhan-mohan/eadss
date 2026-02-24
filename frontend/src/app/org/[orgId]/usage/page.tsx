"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getUsage } from "@/lib/api";

export default function UsagePage({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    localStorage.setItem("eadss_active_org", orgId);
    async function load() {
      setError(null);
      try {
        const res = await getUsage(days);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [days, orgId]);

  const totals = useMemo(() => {
    const requests = (data?.by_day ?? []).reduce((sum: number, row: any) => sum + Number(row.requests ?? 0), 0);
    const avg = (data?.by_day ?? []).length
      ? Math.round((data.by_day as any[]).reduce((sum: number, row: any) => sum + Number(row.avg_latency_ms ?? 0), 0) / data.by_day.length)
      : 0;
    return { requests, avg };
  }, [data]);

  return (
    <main className="app-shell stack">
      <section className="demo-header stack">
        <div className="announce-ribbon">Usage and performance analytics</div>
        <p className="meta">Request volume, latency, and endpoint activity for the selected organization.</p>
      </section>

      <section className="page-header">
        <div>
          <h1 className="page-title">Usage Analytics</h1>
          <p className="page-subtitle">Org: {orgId}</p>
        </div>
        <div className="nav-inline">
          <Link className="button-muted" href={`/org/${orgId}/dashboard`}>
            Dashboard
          </Link>
          <Link className="button-muted" href="/">
            Home
          </Link>
        </div>
      </section>

      <section className="panel row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <span className="label">Window</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
        <span className="meta">API usage across tracked endpoints</span>
      </section>

      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <div className="kpi-label">Total Requests</div>
              <div className="kpi-value">{totals.requests}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-label">Avg Latency</div>
              <div className="kpi-value">{totals.avg} ms</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-label">Tracked Days</div>
              <div className="kpi-value">{data.by_day?.length ?? 0}</div>
            </article>
          </section>

          <section className="panel stack">
            <h2 className="feature-title">Requests by Day</h2>
            <div className="list">
              {data.by_day.map((r: any) => (
                <div key={r.day} className="list-item split">
                  <span>{r.day}</span>
                  <span className="meta">{r.requests} req • avg {Math.round(r.avg_latency_ms)} ms</span>
                </div>
              ))}
              {!data.by_day.length && <div className="empty">No usage activity in this window.</div>}
            </div>
          </section>

          <section className="panel stack">
            <h2 className="feature-title">Top Endpoints</h2>
            <div className="list">
              {data.top_paths.map((r: any) => (
                <div key={r.path} className="list-item split">
                  <span>{r.path}</span>
                  <span className="meta">{r.requests}</span>
                </div>
              ))}
              {!data.top_paths.length && <div className="empty">No endpoint activity in this window.</div>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
