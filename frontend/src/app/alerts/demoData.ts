import { AlertDetail, AlertOut } from "@/lib/api";

export const demoAlerts: AlertOut[] = [
  {
    id: "demo-1",
    created_at: "2026-02-23T09:30:00Z",
    day: "2026-02-23",
    alert_type: "emotion_spike",
    severity: "high",
    org_id: "sample-org",
    team_id: "support",
    channel: "ticket",
    metric: "anger_count",
    value: 18,
    baseline: { mean: 6.2, stddev: 2.1, zscore: 5.6 },
    message: "Anger mentions spiked 3x above baseline in support tickets.",
  },
  {
    id: "demo-2",
    created_at: "2026-02-22T14:10:00Z",
    day: "2026-02-22",
    alert_type: "anxiety_rise",
    severity: "medium",
    org_id: "sample-org",
    team_id: "payments",
    channel: "nps",
    metric: "anxiety_count",
    value: 11,
    baseline: { mean: 5.8, stddev: 1.9, zscore: 2.7 },
    message: "Anxiety trend increased in payment-related NPS comments.",
  },
  {
    id: "demo-3",
    created_at: "2026-02-21T18:45:00Z",
    day: "2026-02-21",
    alert_type: "negative_sentiment_cluster",
    severity: "low",
    org_id: "sample-org",
    team_id: "onboarding",
    channel: "survey",
    metric: "negative_cluster_size",
    value: 7,
    baseline: { mean: 4.0, stddev: 1.5, zscore: 2.0 },
    message: "Small cluster of negative onboarding survey responses detected.",
  },
];

export const demoAlertDetails: Record<string, AlertDetail> = {
  "demo-1": {
    alert: demoAlerts[0],
    evidence: [
      {
        document_id: "doc-101",
        external_id: "TKT-9921",
        contribution: 0.92,
        sentiment: "negative",
        emotion_labels: ["anger", "frustration"],
        text_redacted: "I am extremely frustrated. Your payment failed again and support is not helping.",
        keyword_hits: ["payment failed", "frustrated"],
        highlights: [
          { start: 18, end: 28, label: "emotion", text: "frustrated" },
          { start: 35, end: 49, label: "issue", text: "payment failed" },
        ],
      },
      {
        document_id: "doc-102",
        external_id: "TKT-9930",
        contribution: 0.77,
        sentiment: "negative",
        emotion_labels: ["anger"],
        text_redacted: "This is the third outage this week. I am angry and considering canceling.",
        keyword_hits: ["outage", "canceling"],
        highlights: [{ start: 43, end: 48, label: "emotion", text: "angry" }],
      },
    ],
  },
  "demo-2": {
    alert: demoAlerts[1],
    evidence: [
      {
        document_id: "doc-201",
        external_id: "NPS-551",
        contribution: 0.68,
        sentiment: "neutral",
        emotion_labels: ["anxiety"],
        text_redacted: "I am worried about recurring payment reliability next month.",
        keyword_hits: ["worried", "payment reliability"],
        highlights: [{ start: 5, end: 12, label: "emotion", text: "worried" }],
      },
    ],
  },
  "demo-3": {
    alert: demoAlerts[2],
    evidence: [],
  },
};
