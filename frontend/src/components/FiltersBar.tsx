"use client";

import { useMemo } from "react";

type Props = {
  orgId: string;
  teamId: string;
  since: string;
  until: string;
  onChange: (next: { orgId: string; teamId: string; since: string; until: string }) => void;
};

export default function FiltersBar({ orgId, teamId, since, until, onChange }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const handle = (patch: Partial<{ orgId: string; teamId: string; since: string; until: string }>) =>
    onChange({ orgId, teamId, since, until, ...patch });

  return (
    <section className="panel">
      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <label className="field">
          <span>Organization</span>
          <input value={orgId} onChange={(e) => handle({ orgId: e.target.value })} placeholder="demo" />
        </label>

        <label className="field">
          <span>Team</span>
          <input value={teamId} onChange={(e) => handle({ teamId: e.target.value })} placeholder="support / hr" />
        </label>

        <label className="field">
          <span>Since</span>
          <input type="date" value={since} onChange={(e) => handle({ since: e.target.value })} max={today} />
        </label>

        <label className="field">
          <span>Until</span>
          <input type="date" value={until} onChange={(e) => handle({ until: e.target.value })} max={today} />
        </label>
      </div>
    </section>
  );
}
