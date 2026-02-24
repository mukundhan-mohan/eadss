"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminMe, adminSuperUsers, SuperAdminUser } from "@/lib/api";

export default function SuperAdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const me = await adminMe();
        if (!me.is_super_admin) {
          router.replace("/try-now");
          return;
        }
        const rows = await adminSuperUsers();
        if (!cancelled) setUsers(rows);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          router.replace("/login");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="app-shell">
        <div className="notice">Loading super admin data...</div>
      </main>
    );
  }

  return (
    <main className="app-shell stack">
      <section className="demo-header stack">
        <div className="announce-ribbon">Restricted super admin console</div>
        <p className="meta">Review user accounts, membership state, and credential metadata.</p>
      </section>

      <section className="page-header">
        <div>
          <h1 className="page-title">Super Admin Users</h1>
          <p className="page-subtitle">User accounts and credential metadata</p>
        </div>
        <div className="nav-inline">
          <Link className="button-muted" href="/try-now">
            Back
          </Link>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel stack">
        <div className="list">
          {users.map((u) => (
            <article key={u.id} className="list-item stack">
              <div className="split">
                <strong>{u.email}</strong>
                <span className="meta">
                  {u.is_super_admin ? "super admin" : "admin"} • {u.is_active ? "active" : "inactive"}
                </span>
              </div>
              <div className="meta">Created: {new Date(u.created_at).toLocaleString()}</div>
              <div className="field">
                <span>Password Hash</span>
                <pre className="inline-code">{u.password_hash}</pre>
              </div>
              <div className="field">
                <span>Memberships</span>
                <pre className="inline-code">
                  {u.memberships.length
                    ? u.memberships.map((m) => `${m.org_id} (${m.role})`).join("\n")
                    : "No org memberships"}
                </pre>
              </div>
              <div className="field">
                <span>API Key Hashes</span>
                <pre className="inline-code">
                  {u.api_keys.length
                    ? u.api_keys
                        .map((k) => `${k.org_id} | ${k.name ?? "primary"} | ${k.key_hash} | ${k.is_active ? "active" : "inactive"}`)
                        .join("\n")
                    : "No API keys for linked orgs"}
                </pre>
              </div>
            </article>
          ))}
          {!users.length && <div className="empty">No users found.</div>}
        </div>
      </section>
    </main>
  );
}
