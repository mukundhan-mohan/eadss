import { AlertDetail, AlertOut } from "@/lib/api";

const teams = ["support", "payments", "onboarding", "retention", "shipping", "billing"];
const channels = ["ticket", "nps", "survey", "chat"];
const kinds = [
  { alert_type: "emotion_spike", metric: "anger_count" },
  { alert_type: "anxiety_rise", metric: "anxiety_count" },
  { alert_type: "negative_sentiment_cluster", metric: "negative_cluster_size" },
  { alert_type: "escalation_risk", metric: "escalation_count" },
];

export const demoAlerts: AlertOut[] = Array.from({ length: 24 }).map((_, idx) => {
  const day = 23 - (idx % 14);
  const k = kinds[idx % kinds.length];
  const severity: AlertOut["severity"] = idx % 7 === 0 ? "high" : idx % 3 === 0 ? "medium" : "low";
  const value = 6 + (idx % 10) + (severity === "high" ? 7 : severity === "medium" ? 4 : 1);
  const mean = 3.8 + (idx % 5) * 0.7;
  const stddev = 1.3 + (idx % 4) * 0.4;
  const zscore = Number(((value - mean) / stddev).toFixed(1));

  return {
    id: `demo-${idx + 1}`,
    created_at: `2026-02-${String(day).padStart(2, "0")}T${String(8 + (idx % 10)).padStart(2, "0")}:15:00Z`,
    day: `2026-02-${String(day).padStart(2, "0")}`,
    alert_type: k.alert_type,
    severity,
    org_id: "sample-org",
    team_id: teams[idx % teams.length],
    channel: channels[idx % channels.length],
    metric: k.metric,
    value,
    baseline: { mean, stddev, zscore },
    message: `${k.alert_type.replaceAll("_", " ")} detected for ${teams[idx % teams.length]} on ${channels[idx % channels.length]}.`,
  };
});

export const demoAlertDetails: Record<string, AlertDetail> = {
  [demoAlerts[0].id]: {
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
  [demoAlerts[1].id]: {
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
  [demoAlerts[2].id]: {
    alert: demoAlerts[2],
    evidence: [],
  },
};
