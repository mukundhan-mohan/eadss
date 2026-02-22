export default function ApiDocsPage() {
  return (
    <main className="app-shell stack">
      <section className="hero-card stack">
        <div>
          <h1 className="page-title">API Docs</h1>
          <p className="page-subtitle">Embedded FastAPI Swagger UI from `http://localhost:8000/docs`.</p>
        </div>

        <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <iframe
            title="EADSS API Docs"
            src="http://localhost:8000/docs"
            style={{ width: "100%", height: "78vh", border: 0, display: "block" }}
          />
        </section>
      </section>
    </main>
  );
}
