export default function ApiDocsPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const docsUrl = `${apiBase.replace(/\/$/, "")}/docs`;

  return (
    <main className="app-shell stack">
      <section className="hero-card stack">
        <div className="announce-ribbon">Live backend Swagger documentation</div>
        <div>
          <h1 className="page-title">API Docs</h1>
          <p className="page-subtitle">Embedded FastAPI Swagger UI from `{docsUrl}`.</p>
        </div>

        <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <iframe
            title="EADSS API Docs"
            src={docsUrl}
            style={{ width: "100%", height: "78vh", border: 0, display: "block" }}
          />
        </section>
      </section>
    </main>
  );
}
