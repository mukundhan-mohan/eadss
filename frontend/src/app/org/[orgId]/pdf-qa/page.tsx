"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { askPdfQuestion, getPdfDocument, listPdfDocuments, PdfAskOut, PdfDocumentOut, uploadPdf } from "@/lib/api";

export default function PdfQaPage({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  const [documents, setDocuments] = useState<PdfDocumentOut[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<PdfAskOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments(preserveSelection = true) {
    setLoadingDocs(true);
    try {
      const res = await listPdfDocuments();
      setDocuments(res.items);
      if (!preserveSelection && res.items[0]) {
        setSelectedDocumentId(res.items[0].id);
      } else if (!selectedDocumentId && res.items[0]) {
        setSelectedDocumentId(res.items[0].id);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoadingDocs(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("eadss_active_org", orgId);
    setError(null);
    loadDocuments(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (!pollingId) return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const doc = await getPdfDocument(pollingId);
        if (cancelled) return;

        setDocuments((prev) => prev.map((item) => (item.id === doc.id ? doc : item)));

        if (doc.status === "ready" || doc.status === "failed") {
          window.clearInterval(timer);
          setPollingId(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          window.clearInterval(timer);
          setPollingId(null);
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollingId]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const readyDocuments = useMemo(() => documents.filter((doc) => doc.status === "ready"), [documents]);

  async function onUpload() {
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const created = await uploadPdf(file, title);
      setDocuments((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setSelectedDocumentId(created.id);
      setPollingId(created.id);
      setFile(null);
      setTitle("");
      const input = document.getElementById("pdf-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  async function onAsk() {
    if (!question.trim()) return;

    setAsking(true);
    setError(null);
    try {
      const res = await askPdfQuestion({
        question: question.trim(),
        document_id: selectedDocumentId || undefined,
        top_k: 5,
      });
      setAnswer(res);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setAsking(false);
    }
  }

  function statusTone(status: string) {
    if (status === "ready") return { color: "#18794e", label: "ready" };
    if (status === "failed") return { color: "#b73239", label: "failed" };
    if (status === "processing") return { color: "#b36b00", label: "processing" };
    return { color: "#48657a", label: status };
  }

  return (
    <main className="app-shell stack">
      <section className="demo-header stack">
        <div className="announce-ribbon">Organization PDF knowledge workspace</div>
        <p className="meta">Upload PDFs, wait for local embedding processing, then ask grounded questions with page evidence.</p>
      </section>

      <section className="page-header">
        <div>
          <h1 className="page-title">PDF Q&amp;A</h1>
          <p className="page-subtitle">Org: {orgId}</p>
        </div>
        <div className="nav-inline">
          <Link className="button-muted" href={`/org/${orgId}/dashboard`}>
            Dashboard
          </Link>
          <Link className="button-muted" href={`/org/${orgId}/usage`}>
            Usage
          </Link>
          <Link className="button-muted" href="/">
            Home
          </Link>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Upload PDF</h2>
          <span className="meta">The worker extracts text, chunks it, and builds local embeddings in the background.</span>
        </div>

        <div className="form-cols">
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Policy Handbook" />
          </label>

          <label className="field">
            <span>PDF File</span>
            <input
              id="pdf-file-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="row">
          <button className="button" onClick={onUpload} disabled={uploading || !file}>
            {uploading ? "Uploading..." : "Upload and Process"}
          </button>
          <button className="button-muted" onClick={() => loadDocuments()} type="button">
            Refresh Documents
          </button>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Processed PDFs</h2>
          <span className="meta">{loadingDocs ? "Refreshing..." : `${documents.length} documents`}</span>
        </div>

        <div className="field">
          <span>Select Ready Document</span>
          <select value={selectedDocumentId} onChange={(e) => setSelectedDocumentId(e.target.value)}>
            <option value="">All ready PDFs in this org</option>
            {readyDocuments.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title ?? doc.filename}
              </option>
            ))}
          </select>
        </div>

        <div className="list">
          {documents.map((doc) => {
            const tone = statusTone(doc.status);
            return (
              <article key={doc.id} className="list-item stack">
                <div className="split">
                  <div>
                    <strong>{doc.title ?? doc.filename}</strong>
                    <div className="meta">{doc.filename}</div>
                  </div>
                  <span className="meta" style={{ color: tone.color }}>
                    {tone.label}
                  </span>
                </div>
                <div className="row meta">
                  <span>pages {doc.page_count ?? "-"}</span>
                  <span>• chunks {doc.chunk_count ?? "-"}</span>
                  {doc.embedding_model ? <span>• model {doc.embedding_model}</span> : null}
                </div>
                {doc.error_message ? <div className="error">{doc.error_message}</div> : null}
              </article>
            );
          })}
          {!loadingDocs && documents.length === 0 && <div className="empty">No PDFs uploaded yet.</div>}
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">Ask a Question</h2>
          <span className="meta">
            {selectedDocument ? `Scoped to ${selectedDocument.title ?? selectedDocument.filename}` : "Searching across all ready PDFs in this org"}
          </span>
        </div>

        <label className="field">
          <span>Question</span>
          <textarea
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What does the cancellation policy say?"
          />
        </label>

        <div className="row">
          <button className="button" onClick={onAsk} disabled={asking || !question.trim() || readyDocuments.length === 0}>
            {asking ? "Searching..." : "Ask PDF"}
          </button>
        </div>

        {readyDocuments.length === 0 && (
          <div className="notice">Upload and finish processing at least one PDF before asking questions.</div>
        )}
      </section>

      {answer && (
        <>
          <section className="panel stack">
            <div className="split">
              <h2 className="feature-title">Answer</h2>
              <span className="meta">Grounded by retrieved evidence</span>
            </div>
            <div className="notice">
              <strong>Question:</strong> {answer.question}
            </div>
            <div>{answer.answer}</div>
          </section>

          <section className="panel stack">
            <h2 className="feature-title">Evidence</h2>
            <div className="list">
              {answer.evidence.map((item) => (
                <article key={item.chunk_id} className="list-item stack">
                  <div className="row meta">
                    <span>{item.document_title ?? item.document_id}</span>
                    <span>• page {item.page_number}</span>
                    <span>• chunk {item.chunk_index}</span>
                    <span>• score {item.score.toFixed(3)}</span>
                  </div>
                  <div>{item.excerpt}</div>
                </article>
              ))}
              {answer.evidence.length === 0 && <div className="empty">No evidence returned.</div>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
