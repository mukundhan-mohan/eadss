"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminLogout, adminMe } from "@/lib/api";

export default function TryNowPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await adminMe();
        if (cancelled) return;
        setEmail(me.email);
        setIsSuperAdmin(!!me.is_super_admin);
      } catch {
        if (!cancelled) router.replace("/login");
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await adminLogout();
      router.replace("/login");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="notice">Loading your onboarding workspace...</div>
      </main>
    );
  }

  return (
    <main className="app-shell onboarding-shell">
      <aside className="onboarding-side">
        <div className="onboarding-side-head">
          <h2 className="feature-title">Getting Started</h2>
          <div className="meta">Signed in as {email}</div>
        </div>
        <nav className="onboarding-nav">
          <a href="#step1" className="onboarding-link">
            1. Create Access Token
          </a>
          <a href="#step2" className="onboarding-link">
            2. Configure Environment
          </a>
          <a href="#step3" className="onboarding-link">
            3. Start Embedding
          </a>
          <a href="#step4" className="onboarding-link">
            4. Validate
          </a>
          {isSuperAdmin && (
            <Link href="/super-admin/users" className="onboarding-link">
              Super Admin: Users
            </Link>
          )}
        </nav>
        <button className="button-muted" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </aside>

      <section className="onboarding-main stack">
        <div className="hero-card stack">
          <h1 className="page-title">Integration Procedure</h1>
          <p className="page-subtitle">
            Follow this flow to generate an access token and start sending data from your codebase.
          </p>
          {error && <div className="error">{error}</div>}
        </div>

        <article id="step1" className="panel stack">
          <h2 className="feature-title">1. Create Access Token</h2>
          <p className="meta">
            Open the organization setup page and create your org. The API key shown there is your access token.
          </p>
          <div className="row">
            <Link className="button" href="/register">
              Open Organization Setup
            </Link>
          </div>
        </article>

        <article id="step2" className="panel stack">
          <h2 className="feature-title">2. Configure Environment</h2>
          <p className="meta">Store token and base URL in env vars used by your service.</p>
          <pre className="inline-code">{`EADSS_BASE_URL=http://localhost:8000\nEADSS_API_KEY=eadss_xxx_generated_key`}</pre>
        </article>

        <article id="step3" className="panel stack">
          <h2 className="feature-title">3. Start Embedding in Code</h2>
          <p className="meta">Use your token in request headers from your backend jobs or app services.</p>
          <pre className="inline-code">{`const res = await fetch(process.env.EADSS_BASE_URL + "/api/v1/ingest", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "X-API-Key": process.env.EADSS_API_KEY,\n  },\n  body: JSON.stringify({\n    org_id: "your-org-id",\n    source: "ticket",\n    channel: "support",\n    text: "Customer says the product keeps crashing and is frustrated."\n  })\n});`}</pre>
        </article>

        <article id="step4" className="panel stack">
          <h2 className="feature-title">4. Validate</h2>
          <p className="meta">Confirm ingestion and analytics are flowing in these pages.</p>
          <div className="row">
            <Link className="button-muted" href="/dashboard">
              Dashboard
            </Link>
            <Link className="button-muted" href="/alerts">
              Alerts
            </Link>
            <Link className="button-muted" href="/api-docs">
              API Docs
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
