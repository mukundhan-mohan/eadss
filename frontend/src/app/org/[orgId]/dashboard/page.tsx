"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EmotionStackedArea from "@/components/charts/EmotionStackedArea";
import {
  getDocuments,
  getLatestInference,
  getReviewQueue,
  submitInferenceReview,
  type ReviewQueueItemOut,
} from "@/lib/api";

type Point = { day: string; [emotion: string]: string | number };

type ReviewDraft = {
  status: "approved" | "edited" | "rejected";
  reviewerName: string;
  feedback: string;
  editedSentiment: string;
  editedEmotionLabels: string;
};

const DEFAULT_REVIEW_DRAFT: ReviewDraft = {
  status: "approved",
  reviewerName: "",
  feedback: "",
  editedSentiment: "",
  editedEmotionLabels: "",
};

function draftFromItem(item: ReviewQueueItemOut, reviewerName: string): ReviewDraft {
  return {
    status:
      item.review?.status === "approved" || item.review?.status === "edited" || item.review?.status === "rejected"
        ? item.review.status
        : "approved",
    reviewerName: item.review?.reviewer_name ?? reviewerName,
    feedback: item.review?.feedback ?? "",
    editedSentiment: item.review?.edited_sentiment ?? "",
    editedEmotionLabels: item.review?.edited_emotion_labels?.join(", ") ?? "",
  };
}

function compactText(text: string, maxLength = 280): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function renderReviewStatus(status: string): string {
  if (status === "approved") return "Approved";
  if (status === "edited") return "Edited";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function reviewBadgeClass(status: string): string {
  if (status === "approved") return "review-badge review-badge-approved";
  if (status === "edited") return "review-badge review-badge-edited";
  if (status === "rejected") return "review-badge review-badge-rejected";
  return "review-badge";
}

export default function OrgDashboard({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  const [points, setPoints] = useState<Point[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewQueueItemOut[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [reviewerName, setReviewerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [submittingDocumentId, setSubmittingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    const savedReviewer = typeof window !== "undefined" ? localStorage.getItem("eadss_reviewer_name") ?? "" : "";
    setReviewerName(savedReviewer);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("eadss_reviewer_name", reviewerName);
    }
  }, [reviewerName]);

  useEffect(() => {
    let cancelled = false;
    localStorage.setItem("eadss_active_org", orgId);

    async function loadTrends() {
      setLoading(true);
      setError(null);
      try {
        const since = new Date();
        since.setDate(since.getDate() - 14);
        const docsRes = await getDocuments({
          org_id: orgId,
          limit: 200,
          offset: 0,
          since: since.toISOString(),
          until: new Date().toISOString(),
        });

        const pairs = await Promise.all(
          docsRes.items.map(async (d) => {
            const inf = await getLatestInference(d.id);
            return { doc: d, inf: inf.latest };
          })
        );

        const byDay: Record<string, Point> = {};
        for (const p of pairs) {
          const ts = p.doc.timestamp ?? p.doc.created_at;
          const day = String(ts).slice(0, 10);
          const labels: string[] = p.inf?.emotion_labels?.length ? p.inf.emotion_labels : ["no_inference"];
          byDay[day] ??= { day };
          for (const emo of labels) byDay[day][emo] = Number(byDay[day][emo] ?? 0) + 1;
        }

        const next = Object.values(byDay).sort((a, b) => String(a.day).localeCompare(String(b.day))) as Point[];
        if (!cancelled) setPoints(next);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadReviews() {
      setLoadingReviews(true);
      setReviewError(null);
      try {
        const res = await getReviewQueue({ limit: 6, state: "all" });
        if (cancelled) return;
        setReviewItems(res.items);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const item of res.items) {
            next[item.document_id] = prev[item.document_id] ?? draftFromItem(item, reviewerName);
          }
          return next;
        });
      } catch (e: any) {
        if (!cancelled) setReviewError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoadingReviews(false);
      }
    }

    loadTrends();
    loadReviews();
    return () => {
      cancelled = true;
    };
  }, [orgId, reviewerName]);

  const totalEvents = useMemo(
    () =>
      points.reduce(
        (sum, p) => sum + Object.entries(p).filter(([k]) => k !== "day").reduce((n, [, v]) => n + Number(v ?? 0), 0),
        0
      ),
    [points]
  );

  const reviewSummary = useMemo(() => {
    return reviewItems.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.review_status as "pending" | "approved" | "edited" | "rejected"] =
          (acc[item.review_status as "pending" | "approved" | "edited" | "rejected"] ?? 0) + 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, edited: 0, rejected: 0 }
    );
  }, [reviewItems]);

  async function refreshReviewQueue() {
    setLoadingReviews(true);
    setReviewError(null);
    try {
      const res = await getReviewQueue({ limit: 6, state: "all" });
      setReviewItems(res.items);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const item of res.items) {
          next[item.document_id] = draftFromItem(item, prev[item.document_id]?.reviewerName ?? reviewerName);
        }
        return next;
      });
    } catch (e: any) {
      setReviewError(e?.message ?? String(e));
    } finally {
      setLoadingReviews(false);
    }
  }

  function updateDraft(documentId: string, patch: Partial<ReviewDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [documentId]: {
        ...(prev[documentId] ?? { ...DEFAULT_REVIEW_DRAFT, reviewerName }),
        ...patch,
      },
    }));
  }

  async function handleSubmitReview(documentId: string) {
    const draft = drafts[documentId] ?? { ...DEFAULT_REVIEW_DRAFT, reviewerName };
    setSubmittingDocumentId(documentId);
    setReviewError(null);
    try {
      await submitInferenceReview(documentId, {
        status: draft.status,
        reviewer_name: draft.reviewerName || undefined,
        feedback: draft.feedback || undefined,
        edited_sentiment: draft.status === "edited" && draft.editedSentiment ? draft.editedSentiment : undefined,
        edited_emotion_labels:
          draft.status === "edited" && draft.editedEmotionLabels
            ? draft.editedEmotionLabels
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : undefined,
      });
      await refreshReviewQueue();
    } catch (e: any) {
      setReviewError(e?.message ?? String(e));
    } finally {
      setSubmittingDocumentId(null);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="control-hero">
        <div className="control-hero-copy">
          <span className="hero-kicker">Organization workspace</span>
          <h1 className="page-title">Operate the review loop, not just the model output.</h1>
          <p className="page-subtitle">
            Org: {orgId}. Track emotional pressure trends, inspect AI decisions, and keep reviewers in the approval path.
          </p>
        </div>
        <div className="control-hero-actions">
          <Link className="button-muted" href={`/org/${orgId}/pdf-qa`}>
            PDF Q&A
          </Link>
          <Link className="button-muted" href={`/org/${orgId}/usage`}>
            Usage
          </Link>
          <Link className="button-muted" href="/alerts">
            Alerts
          </Link>
          <Link className="button-muted" href="/">
            Home
          </Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-label">Events (14d)</div>
          <div className="kpi-value">{totalEvents}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Days with Activity</div>
          <div className="kpi-value">{points.length}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Pending Reviews</div>
          <div className="kpi-value">{reviewSummary.pending}</div>
        </article>
        <article className="kpi-card kpi-card-good">
          <div className="kpi-label">Reviewed Items</div>
          <div className="kpi-value">{reviewSummary.total - reviewSummary.pending}</div>
        </article>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Trend surface</span>
            <h2 className="feature-title">Emotion Trends</h2>
          </div>
          <span className="meta">{loading ? "Refreshing..." : "Updated"}</span>
        </div>
        <EmotionStackedArea data={points} />
        {!loading && points.length === 0 && <div className="empty">No trend data yet for this organization.</div>}
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Human-in-the-loop</span>
            <h2 className="feature-title">Human Review Queue</h2>
            <p className="meta">Approve, edit, or reject AI emotion and risk outputs before downstream decisions rely on them.</p>
          </div>
          <button className="button-muted" type="button" onClick={refreshReviewQueue} disabled={loadingReviews}>
            {loadingReviews ? "Refreshing..." : "Refresh Queue"}
          </button>
        </div>

        <div className="form-cols">
          <label className="field">
            <span>Reviewer Name</span>
            <input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="e.g. Mukundhan"
            />
          </label>
        </div>

        {reviewError && <div className="error">{reviewError}</div>}

        <section className="kpi-grid">
          <article className="kpi-card">
            <div className="kpi-label">Pending</div>
            <div className="kpi-value">{reviewSummary.pending}</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">Approved</div>
            <div className="kpi-value">{reviewSummary.approved}</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">Edited</div>
            <div className="kpi-value">{reviewSummary.edited}</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">Rejected</div>
            <div className="kpi-value">{reviewSummary.rejected}</div>
          </article>
        </section>

        <div className="list">
          {reviewItems.map((item) => {
            const draft = drafts[item.document_id] ?? draftFromItem(item, reviewerName);
            const effectiveSentiment = item.review?.edited_sentiment ?? item.inference.sentiment ?? "unknown";
            const effectiveEmotionLabels =
              item.review?.edited_emotion_labels?.length
                ? item.review.edited_emotion_labels
                : item.inference.emotion_labels ?? [];

            return (
              <article key={item.document_id} className="list-item review-item stack">
                <div className="split">
                  <div className="stack" style={{ gap: 6 }}>
                    <strong>{item.external_id || item.document_id.slice(0, 8)}</strong>
                    <span className="meta">
                      {item.source || "document"}{item.channel ? ` • ${item.channel}` : ""} •{" "}
                      {String(item.timestamp || item.inference.created_at).slice(0, 19).replace("T", " ")}
                    </span>
                  </div>
                  <span className={reviewBadgeClass(item.review_status)}>{renderReviewStatus(item.review_status)}</span>
                </div>

                <div className="review-ai-summary">
                  <div className="review-ai-summary-card">
                    <div className="kpi-label">AI Sentiment</div>
                    <div className="review-chip-row">
                      <span className="review-chip">{item.inference.sentiment ?? "unknown"}</span>
                      <span className="review-chip">
                        {item.inference.calibrated_confidence != null
                          ? `${Math.round(item.inference.calibrated_confidence * 100)}% confidence`
                          : "confidence n/a"}
                      </span>
                    </div>
                  </div>
                  <div className="review-ai-summary-card">
                    <div className="kpi-label">Effective Outcome</div>
                    <div className="review-chip-row">
                      <span className="review-chip">{effectiveSentiment}</span>
                      {effectiveEmotionLabels.length > 0 && (
                        <span className="review-chip">{effectiveEmotionLabels.join(", ")}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="panel-soft">
                  <div className="kpi-label">Document Excerpt</div>
                  <p className="review-text">{compactText(item.text_redacted)}</p>
                </div>

                <div className="form-cols">
                  <label className="field">
                    <span>Decision</span>
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        updateDraft(item.document_id, {
                          status: e.target.value as ReviewDraft["status"],
                          reviewerName: draft.reviewerName || reviewerName,
                        })
                      }
                    >
                      <option value="approved">Approve AI output</option>
                      <option value="edited">Edit AI output</option>
                      <option value="rejected">Reject AI output</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Reviewer</span>
                    <input
                      value={draft.reviewerName}
                      onChange={(e) => updateDraft(item.document_id, { reviewerName: e.target.value })}
                      placeholder="Reviewer name"
                    />
                  </label>
                </div>

                {draft.status === "edited" && (
                  <div className="form-cols">
                    <label className="field">
                      <span>Corrected Sentiment</span>
                      <input
                        value={draft.editedSentiment}
                        onChange={(e) => updateDraft(item.document_id, { editedSentiment: e.target.value })}
                        placeholder="negative, neutral, positive"
                      />
                    </label>
                    <label className="field">
                      <span>Corrected Emotion Labels</span>
                      <input
                        value={draft.editedEmotionLabels}
                        onChange={(e) => updateDraft(item.document_id, { editedEmotionLabels: e.target.value })}
                        placeholder="anger, frustration"
                      />
                    </label>
                  </div>
                )}

                <label className="field">
                  <span>Reviewer Feedback</span>
                  <textarea
                    rows={3}
                    value={draft.feedback}
                    onChange={(e) => updateDraft(item.document_id, { feedback: e.target.value })}
                    placeholder="Why you approved, changed, or rejected this AI output."
                  />
                </label>

                <div className="split">
                  <div className="meta">
                    {item.review
                      ? `Last reviewed ${new Date(item.review.reviewed_at).toLocaleString()}`
                      : "No human review recorded yet."}
                  </div>
                  <button
                    className="button"
                    type="button"
                    disabled={submittingDocumentId === item.document_id}
                    onClick={() => handleSubmitReview(item.document_id)}
                  >
                    {submittingDocumentId === item.document_id ? "Saving..." : "Save Review"}
                  </button>
                </div>

                {item.history.length > 0 && (
                  <div className="stack">
                    <div className="kpi-label">Audit Trail</div>
                    <div className="review-history">
                      {item.history.map((entry) => (
                        <div key={entry.id} className="review-history-item">
                          <strong>{entry.action.replaceAll("_", " ")}</strong>
                          <span className="meta">
                            {entry.actor || "unknown reviewer"} • {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {!loadingReviews && reviewItems.length === 0 && (
            <div className="empty">No AI-reviewed documents are available yet for this organization.</div>
          )}
        </div>
      </section>
    </main>
  );
}
