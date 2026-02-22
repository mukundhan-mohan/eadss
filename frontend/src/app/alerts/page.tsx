"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FiltersBar from "@/components/FiltersBar";
import { listAlerts, AlertOut } from "@/lib/api";

export default function AlertsPage() {
  const [orgId, setOrgId] = useState("demo");
  const [teamId, setTeamId] = useState("");
  const [since, setSince] = useState(() => new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState(() => new Date().toISOString().slice(0, 10));

  const [alerts, setAlerts] = useState<AlertOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await listAlerts({ org_id: orgId || undefined, team_id: teamId || undefined, limit: 100 });
        if (!cancelled) setAlerts(res);
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
  }, [orgId, teamId, since, until]);

  return (
    <main className="app-shell stack">
      <section className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">Investigate anomaly events and evidence across teams and channels.</p>
        </div>
        <div className="nav-inline">
          <Link className="button-muted" href="/dashboard">
            Dashboard
          </Link>
          <Link className="button-muted" href="/">
            Home
          </Link>
        </div>
      </section>

      <FiltersBar
        orgId={orgId}
        teamId={teamId}
        since={since}
        until={until}
        onChange={(n) => {
          setOrgId(n.orgId);
          setTeamId(n.teamId);
          setSince(n.since);
          setUntil(n.until);
        }}
      />

      {error && <div className="error">{error}</div>}

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Alert Feed</h2>
          <span className="meta">{loading ? "Loading..." : `${alerts.length} alerts`}</span>
        </div>

        <div className="list">
          {alerts.map((a) => (
            <Link key={a.id} href={`/alerts/${a.id}`} className="list-item">
              <div className="row meta">
                <strong style={{ color: "#173a58" }}>{a.alert_type}</strong>
                <span>• severity {a.severity}</span>
                <span>• day {a.day}</span>
                {a.channel && <span>• channel {a.channel}</span>}
                {a.team_id && <span>• team {a.team_id}</span>}
              </div>
              <div style={{ marginTop: 8 }}>{a.message ?? `${a.metric}: ${a.value}`}</div>
            </Link>
          ))}

          {alerts.length === 0 && !loading && (
            <div className="empty">No alerts available for this filter set.</div>
          )}
        </div>
      </section>
    </main>
  );
}
