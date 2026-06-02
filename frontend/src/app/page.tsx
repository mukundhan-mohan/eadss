"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminMe } from "@/lib/api";

type DemoOutput = {
  sentiment: "positive" | "neutral" | "negative";
  emotions: string[];
  risk: "low" | "medium" | "high";
  confidence: number;
  recommendation: string;
};

type SignalCard = {
  label: string;
  value: string;
  tone: "calm" | "alert" | "bright";
};

const sampleScenarios = [
  "Our team has received multiple angry tickets today. Customers say payments are failing and they are frustrated.",
  "Support queues are stable, but customers are confused about onboarding steps and asking repeated questions.",
  "A major client reported a service outage and the account team is worried this will trigger churn.",
];

export default function HomePage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [sampleText, setSampleText] = useState(sampleScenarios[0]);
  const [output, setOutput] = useState<DemoOutput | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await adminMe();
        if (!cancelled) setIsAuthed(true);
      } catch {
        if (!cancelled) setIsAuthed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function runDemo() {
    const text = sampleText.toLowerCase();
    const emotionHits: string[] = [];

    const anxietyWords = ["anxious", "worried", "uncertain", "nervous"];
    const angerWords = ["angry", "frustrated", "furious", "outraged", "upset"];
    const sadnessWords = ["sad", "disappointed", "hopeless", "down"];
    const joyWords = ["happy", "great", "love", "excellent", "thanks"];
    const riskWords = ["failing", "cancel", "escalate", "complaint", "urgent", "outage", "refund", "churn"];

    const anxietyScore = anxietyWords.filter((w) => text.includes(w)).length;
    const angerScore = angerWords.filter((w) => text.includes(w)).length;
    const sadnessScore = sadnessWords.filter((w) => text.includes(w)).length;
    const joyScore = joyWords.filter((w) => text.includes(w)).length;
    const riskScore = riskWords.filter((w) => text.includes(w)).length;

    if (angerScore) emotionHits.push("anger");
    if (anxietyScore) emotionHits.push("anxiety");
    if (sadnessScore) emotionHits.push("sadness");
    if (joyScore) emotionHits.push("joy");
    if (!emotionHits.length) emotionHits.push("neutral");

    const negativeScore = angerScore + anxietyScore + sadnessScore;
    const sentiment: DemoOutput["sentiment"] =
      joyScore > negativeScore ? "positive" : negativeScore > 0 ? "negative" : "neutral";

    const totalSignal = Math.max(1, joyScore + negativeScore + riskScore);
    const risk: DemoOutput["risk"] =
      riskScore >= 2 || negativeScore >= 3 ? "high" : riskScore > 0 || negativeScore > 0 ? "medium" : "low";
    const confidence = Math.min(0.98, 0.58 + totalSignal * 0.08);

    const recommendation =
      risk === "high"
        ? "Open an alert, route to incident response, and place this in the human review queue immediately."
        : risk === "medium"
          ? "Monitor this pattern for 24h, review strongest evidence, and prepare a response playbook."
          : "No escalation required. Keep tracking trend stability and customer recovery signals.";

    setOutput({
      sentiment,
      emotions: emotionHits,
      risk,
      confidence: Number(confidence.toFixed(2)),
      recommendation,
    });
  }

  const signalCards = useMemo<SignalCard[]>(
    () => [
      { label: "Decision latency", value: "<300 ms", tone: "bright" },
      { label: "Review layer", value: "Human-in-the-loop", tone: "calm" },
      { label: "Signal blend", value: "Emotion + Risk + Topic", tone: "alert" },
    ],
    []
  );

  return (
    <main className="app-shell stack">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="hero-kicker">Explainable AI for enterprise workflows</span>
          <h1 className="home-hero-title">Turn human signals into explainable AI decisions.</h1>
          <p className="home-hero-text">
            EADSS helps teams detect risk, review AI outputs, and act on evidence-backed recommendations with human
            oversight and full auditability.
          </p>

          <div className="home-hero-actions">
            <Link className="button" href={isAuthed ? "/try-now" : "/login"}>
              Launch Workspace
            </Link>
            <Link className="button-secondary" href="/gov-risk">
              Explore GovRisk
            </Link>
            <Link className="button-muted" href="/dashboard">
              Explore Demo Dashboard
            </Link>
            <Link className="button-muted" href="/api-docs">
              View API
            </Link>
          </div>

          <div className="home-hero-trust">
            <span>Explainable outputs</span>
            <span>Human review built in</span>
            <span>Auditable decision trails</span>
          </div>
        </div>

        <div className="home-signal-wall">
          <div className="signal-wall-header">
            <span className="signal-dot" />
            <span>Signal Room</span>
          </div>

          <div className="signal-card-grid">
            {signalCards.map((card) => (
              <article key={card.label} className={`signal-card signal-card-${card.tone}`}>
                <div className="signal-card-label">{card.label}</div>
                <div className="signal-card-value">{card.value}</div>
              </article>
            ))}
          </div>

          <div className="signal-strip">
            <div className="signal-strip-head">
              <span>Current priority</span>
              <strong>Explainable decisions with evidence</strong>
            </div>
            <div className="signal-mini-bars" aria-hidden="true">
              <span style={{ width: "72%" }} />
              <span style={{ width: "48%" }} />
              <span style={{ width: "88%" }} />
              <span style={{ width: "61%" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="story-grid">
        <article className="story-card story-card-spotlight">
          <div className="story-card-head">
            <span className="badge">Why it stands out</span>
            <h2 className="feature-title">Not just model output. AI decisions people can understand and trust.</h2>
          </div>
          <p className="feature-desc">
            EADSS is designed for workflows where explainability matters as much as prediction quality, especially when
            teams need reviewer oversight, evidence-backed escalation paths, and accountable AI behavior.
          </p>
          <div className="story-list">
            <div className="story-list-item">
              <strong>Evidence-first</strong>
              <span>Every recommendation can be traced back to source text, inferred signals, and reviewer action.</span>
            </div>
            <div className="story-list-item">
              <strong>Human-in-the-loop</strong>
              <span>Teams can approve, edit, or reject AI conclusions instead of letting the model decide alone.</span>
            </div>
            <div className="story-list-item">
              <strong>Enterprise-ready governance</strong>
              <span>Use the same system for tickets, alerts, document Q&amp;A, and internal review workflows.</span>
            </div>
          </div>
        </article>

        <article className="story-card">
          <div className="story-card-head">
            <span className="badge">Core surfaces</span>
            <h2 className="feature-title">Product layers</h2>
          </div>
          <div className="feature-grid">
            <article className="feature-item">
              <h3 className="feature-title">Explainable Risk Signals</h3>
              <p className="feature-desc">Trace emotional and operational patterns into transparent, reviewable outputs.</p>
            </article>
            <article className="feature-item">
              <h3 className="feature-title">Review Queue</h3>
              <p className="feature-desc">Create a clear approval lane between AI recommendations and business decisions.</p>
            </article>
            <article className="feature-item">
              <h3 className="feature-title">Evidence Retrieval</h3>
              <p className="feature-desc">Upload enterprise documents and return answers with cited supporting evidence.</p>
            </article>
          </div>
        </article>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Live interaction</span>
            <h2 className="feature-title">Run a quick explainability demo</h2>
          </div>
          <span className="meta">A simple front-door demo of how EADSS frames AI outputs for human review.</span>
        </div>

        <div className="demo-lab-grid">
          <div className="stack">
            <label className="field">
              <span>Scenario</span>
              <select value={sampleText} onChange={(e) => setSampleText(e.target.value)}>
                {sampleScenarios.map((scenario) => (
                  <option key={scenario} value={scenario}>
                    {scenario.slice(0, 72)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Raw support text</span>
              <textarea
                rows={7}
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                placeholder="Paste ticket, NPS comment, or survey response..."
              />
            </label>

            <div className="row">
              <button className="button" onClick={runDemo} disabled={!sampleText.trim()}>
                Analyse Signal
              </button>
            </div>
          </div>

          <div className="demo-output-shell">
            <div className="demo-output-head">
              <span className="badge">Decision output</span>
              <span className="meta">Explainable AI summary</span>
            </div>

            {output ? (
              <div className="stack">
                <div className="kpi-grid">
                  <article className="kpi-card">
                    <div className="kpi-label">Sentiment</div>
                    <div className="kpi-value">{output.sentiment}</div>
                  </article>
                  <article className="kpi-card">
                    <div className="kpi-label">Risk</div>
                    <div className="kpi-value">{output.risk}</div>
                  </article>
                  <article className="kpi-card">
                    <div className="kpi-label">Confidence</div>
                    <div className="kpi-value">{Math.round(output.confidence * 100)}%</div>
                  </article>
                  <article className="kpi-card">
                    <div className="kpi-label">Emotion stack</div>
                    <div className="kpi-value">{output.emotions.join(", ")}</div>
                  </article>
                </div>
                <div className="notice">
                  <strong>Recommended action:</strong> {output.recommendation}
                </div>
              </div>
            ) : (
              <div className="empty">Run the demo to see a sample AI recommendation with risk framing.</div>
            )}
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <div>
            <span className="badge">Developer workflow</span>
            <h2 className="feature-title">Designed to fit existing enterprise systems</h2>
          </div>
          <span className="meta">REST APIs for ingestion, explainability, review workflows, alerts, and PDF retrieval.</span>
        </div>
        <pre className="inline-code">{`const res = await fetch("https://api.eadss.com/api/v1/ingest/tickets", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.EADSS_API_KEY,
  },
  body: JSON.stringify({
    enqueue_inference: true,
    items: [
      {
        org_id: "sample-org",
        source: "ticket",
        channel: "support",
        text: "Customer is frustrated. Payment failed again today."
      }
    ]
  })
});`}</pre>
      </section>
    </main>
  );
}
