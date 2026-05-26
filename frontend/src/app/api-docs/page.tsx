export default function ApiDocsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const docsUrl = `${apiBase.replace(/\/$/, "")}/docs`;

  return (
    <main className="app-shell stack">
      <section className="control-hero">
        <div className="control-hero-copy">
          <span className="hero-kicker">Developer access</span>
          <h1 className="page-title">API Docs</h1>
          <p className="page-subtitle">Live FastAPI Swagger documentation served from {docsUrl}.</p>
        </div>
        <div className="control-hero-actions">
          <a className="button-secondary" href={docsUrl} target="_blank" rel="noreferrer">
            Open Swagger in New Tab
          </a>
        </div>
      </section>

      <div className="panel-soft">
        The docs below are embedded directly from the running backend. If the iframe is blocked by the browser, use
        the button above to open the full Swagger page.
      </div>

      <section className="docs-frame-shell">
        <div className="docs-frame-bar">
          <span className="docs-frame-dot docs-frame-dot-red" />
          <span className="docs-frame-dot docs-frame-dot-amber" />
          <span className="docs-frame-dot docs-frame-dot-green" />
          <span className="docs-frame-label">Swagger UI</span>
        </div>
        <section className="docs-frame-panel">
          <iframe
            title="EADSS API Docs"
            src={docsUrl}
            style={{ width: "100%", height: "78vh", border: 0, display: "block", background: "#ffffff" }}
          />
        </section>
      </section>
    </main>
  );
}
