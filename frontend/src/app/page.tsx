"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminMe } from "@/lib/api";

type DemoOutput = {
  sentiment: "positive" | "neutral" | "negative";
  emotions: string[];
  risk: "low" | "medium" | "high";
  confidence: number;
  recommendation: string;
};

export default function HomePage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [sampleText, setSampleText] = useState(
    "Our team has received multiple angry tickets today. Customers say payments are failing and they are frustrated."
  );
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
    const riskWords = ["failing", "cancel", "escalate", "complaint", "urgent", "outage", "refund"];

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
    const risk: DemoOutput["risk"] = riskScore >= 2 || negativeScore >= 3 ? "high" : riskScore > 0 || negativeScore > 0 ? "medium" : "low";
    const confidence = Math.min(0.98, 0.58 + totalSignal * 0.08);

    const recommendation =
      risk === "high"
        ? "Open an alert, route to incident channel, and notify on-call support lead."
        : risk === "medium"
          ? "Track this topic for 24h and review top evidence tickets."
          : "No escalation required. Continue normal monitoring.";

    setOutput({
      sentiment,
      emotions: emotionHits,
      risk,
      confidence: Number(confidence.toFixed(2)),
      recommendation,
    });
  }

  return (
    <main className="app-shell stack">
      <section className="hero-card">
        <div className="page-header">
          <div>
            <h1 className="page-title">EADSS</h1>
            <p className="page-subtitle">Emotionally-Aware Decision Support System</p>
          </div>
          <span className="badge">Production Intelligence Console</span>
        </div>

        <p className="hero-copy">
          Ingest support interactions with PII redaction, run continuous emotion inference, detect
          statistical spikes, and provide evidence-backed alerts for operational teams.
        </p>

        <div className="feature-grid">
          <article className="feature-item">
            <h2 className="feature-title">PII-safe ingestion</h2>
            <p className="feature-desc">Structured redaction before persistence for compliant workflows.</p>
          </article>
          <article className="feature-item">
            <h2 className="feature-title">Background inference</h2>
            <p className="feature-desc">Asynchronous model processing with low-latency dashboard updates.</p>
          </article>
          <article className="feature-item">
            <h2 className="feature-title">Explainable alerts</h2>
            <p className="feature-desc">Evidence documents, highlights, and score context for incident response.</p>
          </article>
        </div>
      </section>

      <section className="panel stack">
        <div className="row">
          {isAuthed && (
            <Link className="button" href="/register">
              Register Organization
            </Link>
          )}
          <Link className="button-secondary" href="/dashboard">
            Open Demo Dashboard
          </Link>
          <Link className="button-muted" href="/alerts">
            Review Alerts
          </Link>
          <Link className="button-muted" href={isAuthed ? "/try-now" : "/login"}>
            Try Now
          </Link>
          <Link className="button-muted" href="/api-docs">
            API Docs
          </Link>
        </div>
      </section>

      <section className="panel stack">
        <div className="split">
          <h2 className="feature-title">System Example</h2>
          <span className="meta">Submit text to see modeled output</span>
        </div>

        <label className="field">
          <span>Sample Support Text</span>
          <textarea
            rows={5}
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder="Paste ticket, NPS comment, or survey response..."
          />
        </label>

        <div className="row">
          <button className="button" onClick={runDemo} disabled={!sampleText.trim()}>
            Analyze Text
          </button>
        </div>

        {output && (
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
              <div className="kpi-label">Emotions</div>
              <div className="kpi-value">{output.emotions.join(", ")}</div>
            </article>
          </div>
        )}

        {output && <div className="notice"><strong>Recommendation:</strong> {output.recommendation}</div>}
      </section>
    </main>
  );
}
