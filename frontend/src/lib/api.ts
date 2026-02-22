// frontend/src/lib/api.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "dev-local-key";

async function readErrorMessage(res: Response): Promise<string> {
  const defaultMessage = `Request failed (${res.status})`;
  const bodyText = await res.text().catch(() => "");
  if (!bodyText) return defaultMessage;

  try {
    const parsed = JSON.parse(bodyText);
    const detail = parsed?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (typeof first?.msg === "string" && first.msg.trim()) {
        const location = Array.isArray(first?.loc) ? first.loc.join(".") : "";
        return location ? `${first.msg} (${location})` : first.msg;
      }
    }
  } catch {
    // non-JSON error body
  }

  return bodyText.trim() || defaultMessage;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getClientApiKey(),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json() as Promise<T>;
}

export type DocumentOut = {
  id: string;
  external_id?: string | null;
  org_id?: string | null;
  team_id?: string | null;
  source?: string | null;
  channel?: string | null;
  tags?: string[] | null;
  timestamp?: string | null;
  text_redacted: string;
  redaction_summary: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export type DocumentListResponse = {
  total: number;
  limit: number;
  offset: number;
  items: DocumentOut[];
};

export type InferenceOut = {
  id: string;
  inference_run_id: string;
  created_at: string;
  sentiment?: string | null;
  emotion_labels?: string[] | null;
  calibrated_confidence?: number | null;
  result?: any;
};

export type DocumentLatestInferenceResponse = {
  document_id: string;
  latest: InferenceOut | null;
};

export type AlertOut = {
  id: string;
  created_at: string;
  day: string;
  alert_type: string;
  severity: "low" | "medium" | "high";
  org_id?: string | null;
  team_id?: string | null;
  channel?: string | null;
  metric: string;
  value: number;
  baseline: any;
  message?: string | null;
};

export type EvidenceOut = {
  document_id: string;
  contribution: number;
  keyword_hits?: string[] | null;
  highlights?: { start: number; end: number; label: string; text: string }[] | null;

  external_id?: string | null;
  text_redacted?: string | null;
  sentiment?: string | null;
  emotion_labels?: string[] | null;
  calibrated_confidence?: number | null;
};

export type AlertDetail = {
  alert: AlertOut;
  evidence: EvidenceOut[];
};

export function getDocuments(params: {
  org_id?: string;
  team_id?: string;
  since?: string; // ISO
  until?: string; // ISO
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params.org_id) qs.set("org_id", params.org_id);
  if (params.team_id) qs.set("team_id", params.team_id);
  if (params.since) qs.set("since", params.since);
  if (params.until) qs.set("until", params.until);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  return apiFetch<DocumentListResponse>(`/api/v1/documents?${qs.toString()}`);
}

export function getLatestInference(documentId: string) {
  return apiFetch<DocumentLatestInferenceResponse>(
    `/api/v1/documents/${documentId}/inference`
  );
}

export function listAlerts(params: { org_id?: string; team_id?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params.org_id) qs.set("org_id", params.org_id);
  if (params.team_id) qs.set("team_id", params.team_id);
  qs.set("limit", String(params.limit ?? 50));
  return apiFetch<AlertOut[]>(`/api/v1/alerts?${qs.toString()}`);
}

export function getAlert(alertId: string) {
  return apiFetch<AlertDetail>(`/api/v1/alerts/${alertId}`);
}

export function getHealth() {
  return apiFetch<{ status: string }>(`/api/v1/health`, {
    // health usually doesn't need API key, but apiFetch adds it anyway.
    // If you ever remove auth from health, this still works.
    method: "GET",
  });
}

export async function registerOrg(payload: { org_id: string; name: string }) {
  // register is public (no key). If you require admin auth later, change this.
  const res = await fetch(`${API_BASE}/api/v1/orgs/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json() as Promise<{ org_id: string; name: string; api_key: string }>;
}

export function getUsage(days = 7) {
  const qs = new URLSearchParams({ days: String(days) });
  return apiFetch<{ org_id: string; days: number; by_day: any[]; top_paths: any[] }>(`/api/v1/usage?${qs.toString()}`);
}

function getClientApiKey(): string {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_KEY ?? "dev-local-key";

  const activeOrg = localStorage.getItem("eadss_active_org");
  if (activeOrg) {
    const k = localStorage.getItem(`eadss_api_key:${activeOrg}`);
    if (k) return k;
  }

  return process.env.NEXT_PUBLIC_API_KEY ?? "dev-local-key";
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include", // ✅ sends/receives cookie
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json() as Promise<T>;
}

export function adminLogin(email: string, password: string) {
  return adminFetch<{ id: string; email: string }>(`/api/v1/admin/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function adminRegister(email: string, password: string) {
  return adminFetch<{ id: string; email: string }>(`/api/v1/admin/register`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function adminMe() {
  return adminFetch<{ id: string; email: string }>(`/api/v1/admin/me`);
}

export function adminLogout() {
  return adminFetch<{ ok: boolean }>(`/api/v1/admin/logout`, { method: "POST" });
}

export function adminRegisterOrg(payload: { org_id: string; name: string }) {
  return adminFetch<{ org_id: string; name: string; api_key: string }>(`/api/v1/orgs/register`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
