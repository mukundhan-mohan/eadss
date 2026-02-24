"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminMe, adminRegisterOrg } from "@/lib/api";

type OrgLogEntry = {
  org_id: string;
  name: string;
  api_key: string;
  created_at: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ org_id: string; name: string; api_key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [logs, setLogs] = useState<OrgLogEntry[]>([]);

  // guard: must be logged in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await adminMe();
        if (!cancelled) setAdminEmail(me.email);
      } catch {
        router.replace("/login");
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!adminEmail) return;
    const key = `eadss_org_logs:${adminEmail}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setLogs([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as OrgLogEntry[];
      setLogs(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLogs([]);
    }
  }, [adminEmail]);

  function persistLogs(next: OrgLogEntry[]) {
    if (!adminEmail) return;
    localStorage.setItem(`eadss_org_logs:${adminEmail}`, JSON.stringify(next));
    setLogs(next);
  }

  if (!authChecked) {
    return (
      <main className="app-shell">
        <div className="notice">Checking session...</div>
      </main>
    );
  }

  if (!adminEmail) {
    return (
      <main className="app-shell">
        <div className="notice">Redirecting to login...</div>
      </main>
    );
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const r = await adminRegisterOrg({ org_id: orgId.trim(), name: name.trim() });
      setResult(r);
      localStorage.setItem(`eadss_api_key:${r.org_id}`, r.api_key);
      localStorage.setItem("eadss_active_org", r.org_id);
      const next: OrgLogEntry[] = [
        { ...r, created_at: new Date().toISOString() },
        ...logs.filter((l) => l.org_id !== r.org_id),
      ];
      persistLogs(next);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="hero-card stack">
        <div className="announce-ribbon">Authenticated setup only</div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Register Organization</h1>
            <p className="page-subtitle">Create your organization and issue a production API key.</p>
            <span className="meta">Signed in as {adminEmail}</span>
          </div>
          <div className="nav-inline">
            <Link className="button-muted" href="/try-now">
              Back to Onboarding
            </Link>
          </div>
        </div>

        <div className="notice">
          API keys are displayed once. Copy and store them in your secret manager immediately.
        </div>
      </section>

      <section className="panel stack">
        <h2 className="feature-title">Organization Details</h2>

        <div className="form-cols">
          <label className="field">
            <span>Org ID</span>
            <input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="acme-support" />
          </label>

          <label className="field">
            <span>Organization Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Support" />
          </label>
        </div>

        <div className="row">
          <button className="button" onClick={onSubmit} disabled={loading || !orgId.trim() || !name.trim()}>
            {loading ? "Creating..." : "Create Org + API Key"}
          </button>
          <Link className="button-muted" href="/api-docs">
            View API Docs
          </Link>
        </div>

        {error && <div className="error">{error}</div>}
      </section>

      {result && (
        <section className="panel stack">
          <h2 className="feature-title">API Key Issued</h2>
          <div className="kpi-grid">
            <article className="kpi-card">
              <div className="kpi-label">Organization ID</div>
              <div className="kpi-value">{result.org_id}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-label">Organization Name</div>
              <div className="kpi-value">{result.name}</div>
            </article>
          </div>

          <label className="field">
            <span>API Key (copy now)</span>
            <div className="row">
              <input value={result.api_key} readOnly />
            </div>
          </label>

          <div className="notice">
            Use this key from your backend integration in the <code>X-API-Key</code> header.
          </div>

          <div className="row">
            <Link className="button-secondary" href={`/org/${result.org_id}/dashboard`}>
              Open Org Dashboard
            </Link>
            <Link className="button-muted" href="/try-now">
              Continue Setup
            </Link>
          </div>
        </section>
      )}

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Organization Log</h2>
          <span className="meta">{logs.length} entries</span>
        </div>
        <div className="list">
          {logs.map((log) => (
            <article key={log.org_id} className="list-item">
              <div className="split">
                <div>
                  <div>
                    <strong>{log.org_id}</strong> - {log.name}
                  </div>
                  <div className="meta">{new Date(log.created_at).toLocaleString()}</div>
                </div>
                <div className="row">
                  <button
                    className="button-muted"
                    onClick={() => persistLogs(logs.filter((l) => l.org_id !== log.org_id))}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
          {logs.length === 0 && <div className="empty">No organizations created yet.</div>}
        </div>
      </section>
    </main>
  );
}
