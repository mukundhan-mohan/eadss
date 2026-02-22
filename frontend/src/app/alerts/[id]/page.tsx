"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAlert, AlertDetail } from "@/lib/api";

function HighlightedText({ text, highlights }: { text: string; highlights?: any[] | null }) {
  if (!highlights?.length) return <span>{text}</span>;

  const spans = [...highlights].sort((a, b) => a.start - b.start);
  const parts: any[] = [];
  let i = 0;

  for (const s of spans) {
    const start = Math.max(0, Math.min(text.length, s.start));
    const end = Math.max(0, Math.min(text.length, s.end));
    if (start > i) parts.push({ t: text.slice(i, start), hl: false });
    if (end > start) parts.push({ t: text.slice(start, end), hl: true });
    i = Math.max(i, end);
  }
  if (i < text.length) parts.push({ t: text.slice(i), hl: false });

  return (
    <span>
      {parts.map((p, idx) =>
        p.hl ? (
          <mark key={idx} className="mark-soft">
            {p.t}
          </mark>
        ) : (
          <span key={idx}>{p.t}</span>
        )
      )}
    </span>
  );
}

export default function AlertDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<AlertDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const res = await getAlert(params.id);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const alert = data?.alert;

  return (
    <main className="app-shell stack">
      <section className="page-header">
        <div>
          <h1 className="page-title">Alert Detail</h1>
          <p className="page-subtitle">Alert ID: {params.id}</p>
        </div>
        <Link className="button-muted" href="/alerts">
          Back to Alerts
        </Link>
      </section>

      {error && <div className="error">{error}</div>}
      {!data && !error && <div className="notice">Loading alert detail...</div>}

      {alert && (
        <section className="panel stack">
          <div className="row meta">
            <strong style={{ color: "#173a58" }}>{alert.alert_type}</strong>
            <span>• severity {alert.severity}</span>
            <span>• day {alert.day}</span>
          </div>
          <div>{alert.message ?? `${alert.metric}: ${alert.value}`}</div>
          <div className="inline-code">
            <pre>{JSON.stringify(alert.baseline, null, 2)}</pre>
          </div>
        </section>
      )}

      {data?.evidence && (
        <section className="panel stack">
          <h2 className="feature-title">Evidence</h2>
          <div className="list">
            {data.evidence.map((ev) => (
              <article key={ev.document_id} className="list-item stack">
                <div className="row meta">
                  <span>doc: {ev.external_id ?? ev.document_id}</span>
                  <span>• contribution {ev.contribution.toFixed(2)}</span>
                  {ev.sentiment && <span>• sentiment {ev.sentiment}</span>}
                  {ev.emotion_labels?.length ? <span>• emotions {ev.emotion_labels.join(", ")}</span> : null}
                </div>

                <div>
                  <HighlightedText text={ev.text_redacted ?? ""} highlights={ev.highlights} />
                </div>

                {ev.keyword_hits?.length ? (
                  <div className="meta">keywords: {ev.keyword_hits.join(", ")}</div>
                ) : null}
              </article>
            ))}
            {data.evidence.length === 0 && <div className="empty">No evidence attached.</div>}
          </div>
        </section>
      )}
    </main>
  );
}
