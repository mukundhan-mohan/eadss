"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createGovRiskHistoricalRecord,
  createGovRiskIncident,
  listGovRiskHistoricalRecords,
  listGovRiskIncidents,
  submitGovRiskReview,
  type GovRiskHistoricalRecordOut,
  type GovRiskIncidentOut,
} from "@/lib/api";

type IncidentDraft = {
  title: string;
  incidentText: string;
  sector: string;
  department: string;
  severity: "low" | "medium" | "high" | "critical";
  incidentDate: string;
  location: string;
};

type HistoricalDraft = {
  title: string;
  summary: string;
  sector: string;
  department: string;
  severity: "low" | "medium" | "high" | "critical";
  eventDate: string;
  location: string;
  outcome: string;
};

type ReviewDraft = {
  status: "approved" | "edited" | "rejected";
  reviewerName: string;
  feedback: string;
  approvedRiskLevel: string;
  approvedRiskScore: string;
  approvedRecommendedAction: string;
};

const DEFAULT_INCIDENT: IncidentDraft = {
  title: "",
  incidentText: "",
  sector: "Supply Chain",
  department: "Operations",
  severity: "medium",
  incidentDate: "",
  location: "",
};

const DEFAULT_HISTORICAL: HistoricalDraft = {
  title: "",
  summary: "",
  sector: "Supply Chain",
  department: "Operations",
  severity: "medium",
  eventDate: "",
  location: "",
  outcome: "",
};

function compact(text: string, maxLength = 220) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function riskBadgeClass(level: string) {
  if (level === "critical" || level === "high") return "review-badge review-badge-rejected";
  if (level === "medium") return "review-badge review-badge-edited";
  return "review-badge review-badge-approved";
}

function reviewBadgeClass(status: string) {
  if (status === "approved") return "review-badge review-badge-approved";
  if (status === "edited") return "review-badge review-badge-edited";
  if (status === "rejected") return "review-badge review-badge-rejected";
  return "review-badge";
}

function reviewDraftFromIncident(item: GovRiskIncidentOut, reviewerName: string): ReviewDraft {
  return {
    status:
      item.latest_assessment?.human_status === "approved" ||
      item.latest_assessment?.human_status === "edited" ||
      item.latest_assessment?.human_status === "rejected"
        ? item.latest_assessment.human_status
        : "approved",
    reviewerName: item.latest_assessment?.reviewer_name ?? reviewerName,
    feedback: item.latest_assessment?.reviewer_feedback ?? "",
    approvedRiskLevel: item.latest_assessment?.approved_risk_level ?? "",
    approvedRiskScore:
      item.latest_assessment?.approved_risk_score !== null && item.latest_assessment?.approved_risk_score !== undefined
        ? String(item.latest_assessment.approved_risk_score)
        : "",
    approvedRecommendedAction: item.latest_assessment?.approved_recommended_action ?? "",
  };
}

export default function GovRiskPage({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  const [incidentDraft, setIncidentDraft] = useState<IncidentDraft>(DEFAULT_INCIDENT);
  const [historicalDraft, setHistoricalDraft] = useState<HistoricalDraft>(DEFAULT_HISTORICAL);
  const [reviewerName, setReviewerName] = useState("");
  const [incidents, setIncidents] = useState<GovRiskIncidentOut[]>([]);
  const [historicalRecords, setHistoricalRecords] = useState<GovRiskHistoricalRecordOut[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingIncident, setSavingIncident] = useState(false);
  const [savingHistorical, setSavingHistorical] = useState(false);
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedReviewer = typeof window !== "undefined" ? localStorage.getItem("eadss_reviewer_name") ?? "" : "";
    setReviewerName(savedReviewer);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("eadss_reviewer_name", reviewerName);
      localStorage.setItem("eadss_active_org", orgId);
    }
  }, [orgId, reviewerName]);

  async function refreshData() {
    setLoading(true);
    setError(null);
    try {
      const [incidentRes, historicalRes] = await Promise.all([
        listGovRiskIncidents(12),
        listGovRiskHistoricalRecords(8),
      ]);
      setIncidents(incidentRes.items);
      setHistoricalRecords(historicalRes.items);
      setReviewDrafts((prev) => {
        const next = { ...prev };
        for (const item of incidentRes.items) {
          next[item.id] = prev[item.id] ?? reviewDraftFromIncident(item, reviewerName);
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();
  }, [orgId]);

  const summary = useMemo(() => {
    return incidents.reduce(
      (acc, item) => {
        const assessment = item.latest_assessment;
        if (!assessment) return acc;
        acc.total += 1;
        acc[assessment.risk_level as "low" | "medium" | "high" | "critical"] += 1;
        acc.pending += assessment.human_status === "pending" ? 1 : 0;
        return acc;
      },
      { total: 0, low: 0, medium: 0, high: 0, critical: 0, pending: 0 }
    );
  }, [incidents]);

  async function handleCreateIncident() {
    setSavingIncident(true);
    setError(null);
    try {
      await createGovRiskIncident({
        title: incidentDraft.title,
        incident_text: incidentDraft.incidentText,
        sector: incidentDraft.sector,
        department: incidentDraft.department,
        severity: incidentDraft.severity,
        incident_date: incidentDraft.incidentDate || undefined,
        location: incidentDraft.location || undefined,
      });
      setIncidentDraft(DEFAULT_INCIDENT);
      await refreshData();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingIncident(false);
    }
  }

  async function handleCreateHistorical() {
    setSavingHistorical(true);
    setError(null);
    try {
      await createGovRiskHistoricalRecord({
        title: historicalDraft.title,
        summary: historicalDraft.summary,
        sector: historicalDraft.sector,
        department: historicalDraft.department || undefined,
        severity: historicalDraft.severity,
        event_date: historicalDraft.eventDate || undefined,
        location: historicalDraft.location || undefined,
        outcome: historicalDraft.outcome || undefined,
      });
      setHistoricalDraft(DEFAULT_HISTORICAL);
      await refreshData();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingHistorical(false);
    }
  }

  function updateReviewDraft(incidentId: string, patch: Partial<ReviewDraft>) {
    const incident = incidents.find((row) => row.id === incidentId);
    setReviewDrafts((prev) => ({
      ...prev,
      [incidentId]: {
        ...(prev[incidentId] ?? (incident ? reviewDraftFromIncident(incident, reviewerName) : {
          status: "approved",
          reviewerName,
          feedback: "",
          approvedRiskLevel: "",
          approvedRiskScore: "",
          approvedRecommendedAction: "",
        })),
        ...patch,
      },
    }));
  }

  async function handleSubmitReview(incidentId: string) {
    const draft = reviewDrafts[incidentId];
    if (!draft) return;
    setSubmittingReviewId(incidentId);
    setError(null);
    try {
      await submitGovRiskReview(incidentId, {
        status: draft.status,
        reviewer_name: draft.reviewerName || undefined,
        feedback: draft.feedback || undefined,
        approved_risk_level: draft.status === "edited" && draft.approvedRiskLevel ? draft.approvedRiskLevel : undefined,
        approved_risk_score:
          draft.status === "edited" && draft.approvedRiskScore ? Number(draft.approvedRiskScore) : undefined,
        approved_recommended_action:
          draft.status === "edited" && draft.approvedRecommendedAction ? draft.approvedRecommendedAction : undefined,
      });
      await refreshData();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmittingReviewId(null);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="control-hero">
        <div className="control-hero-copy">
          <span className="hero-kicker">EADSS extension</span>
          <h1 className="page-title">AI Governance &amp; Risk Intelligence</h1>
          <p className="page-subtitle">
            Org: {orgId}. Assess incidents against policy evidence, historical records, and human approval controls.
          </p>
        </div>
        <div className="control-hero-actions">
          <Link className="button-muted" href={`/org/${orgId}/dashboard`}>
            Dashboard
          </Link>
          <Link className="button-muted" href={`/org/${orgId}/pdf-qa`}>
            Policy PDFs
          </Link>
          <Link className="button-muted" href={`/org/${orgId}/usage`}>
            Usage
          </Link>
          <Link className="button-muted" href="/">
            Home
          </Link>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-label">Incidents</div>
          <div className="kpi-value">{summary.total}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">Pending Approval</div>
          <div className="kpi-value">{summary.pending}</div>
        </article>
        <article className="kpi-card">
          <div className="kpi-label">High / Critical</div>
          <div className="kpi-value">{summary.high + summary.critical}</div>
        </article>
        <article className="kpi-card kpi-card-good">
          <div className="kpi-label">Historical Records</div>
          <div className="kpi-value">{historicalRecords.length}</div>
        </article>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="feature-grid gov-risk-grid">
        <article className="panel stack">
          <div className="split">
            <div>
              <span className="badge">New assessment</span>
              <h2 className="feature-title">Create Incident</h2>
            </div>
            <span className="meta">RAG + metadata + recurrence scoring</span>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Incident title</span>
              <input
                value={incidentDraft.title}
                onChange={(e) => setIncidentDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Repeated data access failure in supplier onboarding"
              />
            </label>
            <label className="field">
              <span>Incident report text</span>
              <textarea
                rows={5}
                value={incidentDraft.incidentText}
                onChange={(e) => setIncidentDraft((prev) => ({ ...prev, incidentText: e.target.value }))}
                placeholder="Describe the governance or controls issue in plain language."
              />
            </label>
            <div className="form-cols">
              <label className="field">
                <span>Sector</span>
                <input
                  value={incidentDraft.sector}
                  onChange={(e) => setIncidentDraft((prev) => ({ ...prev, sector: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Department</span>
                <input
                  value={incidentDraft.department}
                  onChange={(e) => setIncidentDraft((prev) => ({ ...prev, department: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-cols">
              <label className="field">
                <span>Severity</span>
                <select
                  value={incidentDraft.severity}
                  onChange={(e) =>
                    setIncidentDraft((prev) => ({ ...prev, severity: e.target.value as IncidentDraft["severity"] }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={incidentDraft.incidentDate}
                  onChange={(e) => setIncidentDraft((prev) => ({ ...prev, incidentDate: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Location</span>
                <input
                  value={incidentDraft.location}
                  onChange={(e) => setIncidentDraft((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="London"
                />
              </label>
            </div>
            <button className="button" type="button" onClick={handleCreateIncident} disabled={savingIncident}>
              {savingIncident ? "Scoring Incident..." : "Analyze Incident"}
            </button>
          </div>
        </article>

        <article className="panel stack">
          <div className="split">
            <div>
              <span className="badge">Context memory</span>
              <h2 className="feature-title">Historical Risk Records</h2>
            </div>
            <span className="meta">Feed recurrence and similarity checks</span>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Record title</span>
              <input
                value={historicalDraft.title}
                onChange={(e) => setHistoricalDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Prior supplier access control outage"
              />
            </label>
            <label className="field">
              <span>Summary</span>
              <textarea
                rows={4}
                value={historicalDraft.summary}
                onChange={(e) => setHistoricalDraft((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="Short narrative of the prior risk event and why it matters."
              />
            </label>
            <div className="form-cols">
              <label className="field">
                <span>Sector</span>
                <input
                  value={historicalDraft.sector}
                  onChange={(e) => setHistoricalDraft((prev) => ({ ...prev, sector: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Department</span>
                <input
                  value={historicalDraft.department}
                  onChange={(e) => setHistoricalDraft((prev) => ({ ...prev, department: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-cols">
              <label className="field">
                <span>Severity</span>
                <select
                  value={historicalDraft.severity}
                  onChange={(e) =>
                    setHistoricalDraft((prev) => ({ ...prev, severity: e.target.value as HistoricalDraft["severity"] }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="field">
                <span>Event date</span>
                <input
                  type="date"
                  value={historicalDraft.eventDate}
                  onChange={(e) => setHistoricalDraft((prev) => ({ ...prev, eventDate: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Location</span>
                <input
                  value={historicalDraft.location}
                  onChange={(e) => setHistoricalDraft((prev) => ({ ...prev, location: e.target.value }))}
                />
              </label>
            </div>
            <label className="field">
              <span>Outcome</span>
              <textarea
                rows={3}
                value={historicalDraft.outcome}
                onChange={(e) => setHistoricalDraft((prev) => ({ ...prev, outcome: e.target.value }))}
                placeholder="Resolved through governance review and access control remediation."
              />
            </label>
            <button className="button-secondary" type="button" onClick={handleCreateHistorical} disabled={savingHistorical}>
              {savingHistorical ? "Saving Record..." : "Add Historical Record"}
            </button>
          </div>
        </article>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Risk queue</span>
            <h2 className="feature-title">Recent Assessments</h2>
          </div>
          <span className="meta">{loading ? "Refreshing..." : "Live governance decisions"}</span>
        </div>

        {incidents.length === 0 && !loading && (
          <div className="empty">No incidents yet. Create one above to generate a policy-backed risk assessment.</div>
        )}

        <div className="list">
          {incidents.map((incident) => {
            const assessment = incident.latest_assessment;
            const draft = reviewDrafts[incident.id] ?? reviewDraftFromIncident(incident, reviewerName);

            return (
              <article key={incident.id} className="review-item">
                <div className="split">
                  <div>
                    <strong>{incident.title}</strong>
                    <div className="meta">
                      {incident.sector} • {incident.department} • {incident.location || "No location"} •{" "}
                      {incident.incident_date || incident.created_at.slice(0, 10)}
                    </div>
                  </div>
                  {assessment && <span className={riskBadgeClass(assessment.risk_level)}>{assessment.risk_level}</span>}
                </div>

                <p className="review-text">{compact(incident.incident_text, 320)}</p>

                {assessment && (
                  <>
                    <div className="feature-grid">
                      <div className="review-ai-summary-card">
                        <span className="meta">Risk score</span>
                        <strong>{Math.round(assessment.risk_score * 100)}%</strong>
                      </div>
                      <div className="review-ai-summary-card">
                        <span className="meta">Policy match</span>
                        <strong>{assessment.policy_match || "No direct policy match yet"}</strong>
                      </div>
                      <div className="review-ai-summary-card">
                        <span className="meta">Matched records</span>
                        <strong>{assessment.matched_record_count}</strong>
                      </div>
                      <div className="review-ai-summary-card">
                        <span className="meta">Human status</span>
                        <strong className={reviewBadgeClass(assessment.human_status)}>{assessment.human_status}</strong>
                      </div>
                    </div>

                    <div className="panel-soft stack">
                      <div>
                        <span className="meta">Reason</span>
                        <p className="review-text">{assessment.reason}</p>
                      </div>
                      <div>
                        <span className="meta">Recommended action</span>
                        <p className="review-text">{assessment.recommended_action}</p>
                      </div>
                      {assessment.evidence.length > 0 && (
                        <div className="stack">
                          <span className="meta">Evidence from policy documents</span>
                          {assessment.evidence.map((row) => (
                            <div key={`${row.document_id}-${row.chunk_index}`} className="review-history-item">
                              <strong>
                                {row.document_title || "Policy document"} • page {row.page_number}
                              </strong>
                              <div className="meta">Similarity score {Math.round(row.score * 100)}%</div>
                              <p className="review-text">{row.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {assessment.reasoning && (
                        <div className="stack">
                          <span className="meta">{assessment.reasoning.question}</span>
                          <p className="review-text">{assessment.reasoning.answer}</p>
                          <div className="knowledge-graph-card">
                            <div className="knowledge-graph-head">
                              <span className="badge">Reasoning chain</span>
                              <span className="meta">{assessment.reasoning.entities.length} entities</span>
                            </div>
                            <div className="knowledge-chain">
                              {assessment.reasoning.relations.map((edge, index) => (
                                <div key={`${edge.source}-${edge.relation}-${edge.target}-${index}`} className="knowledge-edge">
                                  <div className="knowledge-node">
                                    <span className="knowledge-node-label">Source</span>
                                    <strong>{edge.source}</strong>
                                  </div>
                                  <div className="knowledge-link">
                                    <span className="knowledge-link-line" aria-hidden="true" />
                                    <span className="knowledge-arrow">{edge.relation}</span>
                                    <span className="knowledge-link-line" aria-hidden="true" />
                                  </div>
                                  <div className="knowledge-node knowledge-node-target">
                                    <span className="knowledge-node-label">Target</span>
                                    <strong>{edge.target}</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-grid">
                      <div className="form-cols">
                        <label className="field">
                          <span>Decision</span>
                          <select
                            value={draft.status}
                            onChange={(e) =>
                              updateReviewDraft(incident.id, {
                                status: e.target.value as ReviewDraft["status"],
                              })
                            }
                          >
                            <option value="approved">Approve AI output</option>
                            <option value="edited">Edit risk outcome</option>
                            <option value="rejected">Reject output</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Reviewer</span>
                          <input
                            value={draft.reviewerName}
                            onChange={(e) => updateReviewDraft(incident.id, { reviewerName: e.target.value })}
                            placeholder="Reviewer name"
                          />
                        </label>
                      </div>

                      {draft.status === "edited" && (
                        <div className="form-cols">
                          <label className="field">
                            <span>Approved risk level</span>
                            <select
                              value={draft.approvedRiskLevel}
                              onChange={(e) => updateReviewDraft(incident.id, { approvedRiskLevel: e.target.value })}
                            >
                              <option value="">Keep AI risk level</option>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </label>
                          <label className="field">
                            <span>Approved risk score</span>
                            <input
                              value={draft.approvedRiskScore}
                              onChange={(e) => updateReviewDraft(incident.id, { approvedRiskScore: e.target.value })}
                              placeholder="0.0 to 1.0"
                            />
                          </label>
                          <label className="field">
                            <span>Approved action</span>
                            <input
                              value={draft.approvedRecommendedAction}
                              onChange={(e) =>
                                updateReviewDraft(incident.id, { approvedRecommendedAction: e.target.value })
                              }
                              placeholder="Refined human action"
                            />
                          </label>
                        </div>
                      )}

                      <label className="field">
                        <span>Reviewer feedback</span>
                        <textarea
                          rows={3}
                          value={draft.feedback}
                          onChange={(e) => updateReviewDraft(incident.id, { feedback: e.target.value })}
                          placeholder="Explain why you approved, edited, or rejected this risk assessment."
                        />
                      </label>

                      <button
                        className="button-muted"
                        type="button"
                        onClick={() => handleSubmitReview(incident.id)}
                        disabled={submittingReviewId === incident.id}
                      >
                        {submittingReviewId === incident.id ? "Saving Review..." : "Save Review"}
                      </button>
                    </div>

                    {incident.history.length > 0 && (
                      <div className="stack">
                        <span className="meta">Audit history</span>
                        {incident.history.map((entry) => (
                          <div key={entry.id} className="review-history-item">
                            <strong>{entry.action.replaceAll("_", " ")}</strong>
                            <div className="meta">
                              {entry.actor || "system"} • {new Date(entry.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Historical context</span>
            <h2 className="feature-title">Recent Historical Records</h2>
          </div>
          <span className="meta">Used for similarity and recurrence checks</span>
        </div>
        {historicalRecords.length === 0 && !loading && (
          <div className="empty">No historical records yet. Add prior incidents above to improve recurrence analysis.</div>
        )}
        <div className="list">
          {historicalRecords.map((record) => (
            <article key={record.id} className="card stack">
              <div className="split">
                <strong>{record.title}</strong>
                <span className={riskBadgeClass(record.severity)}>{record.severity}</span>
              </div>
              <div className="meta">
                {record.sector} • {record.department || "No department"} • {record.location || "No location"}
              </div>
              <p className="review-text">{compact(record.summary, 260)}</p>
              {record.outcome && (
                <div className="panel-soft">
                  <span className="meta">Outcome</span>
                  <p className="review-text">{record.outcome}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
