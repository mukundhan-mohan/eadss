"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import FiltersBar from "@/components/FiltersBar";
import { demoAlerts } from "@/app/alerts/demoData";

export default function AlertsPage() {
  const [orgId, setOrgId] = useState("sample-org");
  const [teamId, setTeamId] = useState("");
  const [since, setSince] = useState(() => new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState(() => new Date().toISOString().slice(0, 10));
  const alerts = useMemo(
    () =>
      demoAlerts.filter((a) => {
        const orgOk = !orgId.trim() || (a.org_id ?? "").toLowerCase().includes(orgId.trim().toLowerCase());
        const teamOk = !teamId.trim() || (a.team_id ?? "").toLowerCase().includes(teamId.trim().toLowerCase());
        const sinceOk = !since || a.day >= since;
        const untilOk = !until || a.day <= until;
        return orgOk && teamOk && sinceOk && untilOk;
      }),
    [orgId, teamId, since, until]
  );

  return (
    <main className="app-shell stack">
      <section className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">Public demo anomaly events and explainable evidence cards.</p>
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

      <div className="notice">This page uses sample public alerts for product demonstration.</div>

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Alert Feed</h2>
          <span className="meta">{`${alerts.length} alerts`}</span>
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

          {alerts.length === 0 && (
            <div className="empty">No alerts available for this filter set.</div>
          )}
        </div>
      </section>
    </main>
  );
}
