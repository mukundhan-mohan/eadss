"use client";

import Link from "next/link";

const featureSteps = [
  {
    title: "Ingest the incident",
    text: "Capture the report text alongside sector, department, severity, date, and location so risk decisions start with structured operational context.",
  },
  {
    title: "Retrieve policy evidence",
    text: "Run semantic retrieval across uploaded policy PDFs to surface the sections most relevant to the current governance issue.",
  },
  {
    title: "Score and explain risk",
    text: "Blend policy evidence, metadata weighting, and historical recurrence into a risk level, reason, policy match, and recommended action.",
  },
  {
    title: "Keep humans in the loop",
    text: "Require reviewer approval, edits, or rejection before the recommendation becomes a trusted operational decision.",
  },
];

const outputCards = [
  { label: "Risk level", value: "High", tone: "alert" as const },
  { label: "Policy match", value: "Data Governance §4.2", tone: "bright" as const },
  { label: "Human status", value: "Pending approval", tone: "calm" as const },
];

export default function GovRiskFeaturePage() {
  return (
    <main className="app-shell stack">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="hero-kicker">EADSS extension</span>
          <h1 className="home-hero-title">AI Governance &amp; Risk Intelligence for policy-backed decisions.</h1>
          <p className="home-hero-text">
            GovRisk extends EADSS with a dedicated workflow for incident assessment, policy retrieval, risk scoring,
            and human approval. It is built for cases where explainability and governance controls matter as much as
            speed.
          </p>

          <div className="home-hero-actions">
            <Link className="button" href="/try-now">
              Open Workspace
            </Link>
            <Link className="button-secondary" href="/api-docs">
              Review API Surface
            </Link>
            <Link className="button-muted" href="/dashboard">
              View Core Platform
            </Link>
          </div>

          <div className="home-hero-trust">
            <span>Policy-aware RAG</span>
            <span>Historical recurrence checks</span>
            <span>Human approval required</span>
          </div>
        </div>

        <div className="home-signal-wall">
          <div className="signal-wall-header">
            <span className="signal-dot" />
            <span>GovRisk output</span>
          </div>

          <div className="signal-card-grid signal-card-grid-compact">
            {outputCards.map((card) => (
              <article key={card.label} className={`signal-card signal-card-${card.tone}`}>
                <div className="signal-card-label">{card.label}</div>
                <div className="signal-card-value">{card.value}</div>
              </article>
            ))}
          </div>

          <div className="signal-strip">
            <div className="signal-strip-head">
              <span>Example incident</span>
              <strong>Repeated data access failure in supplier onboarding</strong>
            </div>
            <p className="feature-desc" style={{ marginTop: 12 }}>
              The system finds repeated similar events, links them to control failures, cites policy evidence, and
              recommends escalation for governance review.
            </p>
          </div>
        </div>
      </section>

      <section className="story-grid">
        <article className="story-card story-card-spotlight">
          <div className="story-card-head">
            <span className="badge">What it adds</span>
            <h2 className="feature-title">A separate governance lane inside EADSS.</h2>
          </div>
          <p className="feature-desc">
            GovRisk is designed as its own operational surface. It does not replace the core emotion and review
            workflows. It extends them with policy intelligence, structured risk context, and governance-grade audit
            controls.
          </p>
          <div className="story-list">
            <div className="story-list-item">
              <strong>Incident-first workflow</strong>
              <span>Start from governance events, not support sentiment, and keep the metadata that risk teams need.</span>
            </div>
            <div className="story-list-item">
              <strong>Evidence-backed output</strong>
              <span>Every risk recommendation is paired with policy excerpts and a clear narrative reason.</span>
            </div>
            <div className="story-list-item">
              <strong>Approval and audit trail</strong>
              <span>Reviewer actions are stored so the final decision is traceable, editable, and accountable.</span>
            </div>
          </div>
        </article>

        <article className="story-card">
          <div className="story-card-head">
            <span className="badge">Best-fit use cases</span>
            <h2 className="feature-title">Where GovRisk helps most</h2>
          </div>
          <div className="feature-grid">
            <article className="feature-item">
              <h3 className="feature-title">Data governance incidents</h3>
              <p className="feature-desc">Assess access-control failures, repeated exceptions, and policy breaches with cited evidence.</p>
            </article>
            <article className="feature-item">
              <h3 className="feature-title">Supplier and onboarding risk</h3>
              <p className="feature-desc">Track recurring control issues in supply-chain and vendor workflows before they widen.</p>
            </article>
            <article className="feature-item">
              <h3 className="feature-title">Internal compliance review</h3>
              <p className="feature-desc">Support governance teams with consistent scoring, recommended actions, and human sign-off.</p>
            </article>
          </div>
        </article>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">How it works</span>
            <h2 className="feature-title">From incident text to reviewer-approved action</h2>
          </div>
          <span className="meta">Separate extension, shared EADSS platform foundations</span>
        </div>

        <div className="feature-grid">
          {featureSteps.map((step, index) => (
            <article key={step.title} className="feature-item">
              <div className="signal-card-label">Step {index + 1}</div>
              <h3 className="feature-title">{step.title}</h3>
              <p className="feature-desc">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Explainability view</span>
            <h2 className="feature-title">Explainable Risk Intelligence</h2>
          </div>
          <span className="meta">A concrete example of how GovRisk justifies a recommendation.</span>
        </div>

        <div className="story-grid">
          <article className="story-card story-card-spotlight stack">
            <div>
              <span className="signal-card-label">Risk Score</span>
              <div className="page-title" style={{ marginTop: 8 }}>82%</div>
            </div>

            <div className="stack">
              <strong>Why?</strong>
              <div className="story-list">
                <div className="story-list-item">
                  <span>Policy violation detected</span>
                </div>
                <div className="story-list-item">
                  <span>Similar incident occurred 4 times</span>
                </div>
                <div className="story-list-item">
                  <span>Linked operational dependency identified</span>
                </div>
              </div>
            </div>
          </article>

          <article className="story-card stack">
            <div>
              <strong>Evidence</strong>
            </div>
            <div className="story-list">
              <div className="story-list-item">
                <span>Policy section 4.2</span>
              </div>
              <div className="story-list-item">
                <span>Incident #381</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="demo-lab-grid">
        <article className="panel stack">
          <div className="story-card-head">
            <span className="badge">Input example</span>
            <h2 className="feature-title">What teams provide</h2>
          </div>
          <div className="panel-soft stack">
            <div>
              <strong>Incident</strong>
              <p className="review-text">Repeated data access failure in supplier onboarding.</p>
            </div>
            <div>
              <strong>Metadata</strong>
              <p className="review-text">Sector: Supply Chain • Severity: Medium • Region: London</p>
            </div>
            <div>
              <strong>Policy set</strong>
              <p className="review-text">Uploaded governance and data-control PDFs from the existing EADSS document layer.</p>
            </div>
          </div>
        </article>

        <article className="demo-output-shell stack">
          <div className="demo-output-head">
            <span className="badge">Output example</span>
            <span className="meta">Explainable governance decision</span>
          </div>
          <div className="panel-soft stack">
            <div>
              <strong>Risk level</strong>
              <p className="review-text">High</p>
            </div>
            <div>
              <strong>Reason</strong>
              <p className="review-text">
                Similar incidents have repeated three times and align with policy-controlled data access controls.
              </p>
            </div>
            <div>
              <strong>Evidence</strong>
              <p className="review-text">Data Governance Policy, section near page 4.2.</p>
            </div>
            <div>
              <strong>Recommended action</strong>
              <p className="review-text">Escalate for governance review.</p>
            </div>
            <div>
              <strong>Human approval</strong>
              <p className="review-text">Pending reviewer approval or edit.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Get started</span>
            <h2 className="feature-title">Use GovRisk inside an organization workspace</h2>
          </div>
          <span className="meta">Upload policy PDFs first, then create incidents and historical records.</span>
        </div>
        <div className="page-actions">
          <Link className="button" href="/try-now">
            Go to Workspace
          </Link>
          <Link className="button-secondary" href="/api-docs">
            Explore Endpoints
          </Link>
        </div>
      </section>
    </main>
  );
}
