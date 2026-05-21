# EADSS Project Documentation

## 1. What This Project Is

EADSS stands for **Emotionally-Aware Decision Support System**.

At a high level, this project ingests unstructured text events such as support tickets or feedback, removes basic personally identifiable information, runs lightweight emotion and sentiment inference, aggregates those signals over time, and generates explainable alerts backed by evidence.

The repository contains:

- A **FastAPI backend** that exposes APIs, persists data, performs auth, and serves as the orchestration layer.
- A **Celery worker + beat scheduler** for asynchronous inference and scheduled analytics.
- A **PostgreSQL database** for source data, inference outputs, aggregates, alerts, audit logs, and admin state.
- A **Redis instance** used as the Celery broker/result backend.
- A **Next.js frontend** that mixes public demo pages with authenticated onboarding and org-specific views.

This is not a Laravel project. The live implementation in this repository is Python/FastAPI on the backend and Next.js/React on the frontend.

---

## 2. Core Product Concept

The system is built around this pipeline:

1. A client sends ticket-like text to the ingestion API.
2. The backend redacts email addresses and phone numbers.
3. The backend stores the redacted document plus metadata.
4. A background worker optionally runs sentiment/emotion inference.
5. Daily scheduled jobs aggregate those inference results by org/team/channel/source.
6. Alerting jobs detect abnormal negative sentiment spikes.
7. The system ranks evidence documents and stores explanation artifacts such as:
   - confidence scores
   - emotion labels
   - keyword hits
   - highlighted spans
   - baseline statistics
8. The frontend or API consumers retrieve alerts, evidence, usage analytics, and document/inference data.

The design emphasis is not just prediction, but **explainable operational decisions**.

---

## 3. Repository Layout

```text
eadss/
  .env.example
  docker-compose.yml
  docs_AWS_DEPLOY.md
  scripts/
  backend/
    pyproject.toml
    alembic/
    app/
      api/
      core/
      db/
      ml/
      schemas/
      tasks/
      utils/
  frontend/
    package.json
    src/
      app/
      components/
      lib/
```

Key folders:

- `backend/app/api/v1/endpoints`: REST API endpoints.
- `backend/app/core`: config, auth, Celery app, PII redaction support.
- `backend/app/db/models`: SQLAlchemy ORM models.
- `backend/app/tasks`: Celery background jobs.
- `backend/app/ml/models`: inference logic.
- `backend/app/utils`: explanation helpers and synthetic data generation.
- `frontend/src/app`: Next.js routes/pages.
- `frontend/src/lib/api.ts`: frontend API client.

---

## 4. Runtime Architecture

## 4.1 Services

Defined in [docker-compose.yml](/Users/mukundhanmohan/Desktop/EADSS/eadss/docker-compose.yml):

- `postgres`
  - Postgres 16
  - stores application data
- `redis`
  - Celery broker/backend
- `backend`
  - FastAPI app served by `uvicorn`
- `worker`
  - Celery worker for async jobs
- `beat`
  - Celery beat scheduler for recurring jobs
- `frontend`
  - Next.js app served in dev mode

## 4.2 Configuration

Defined in [.env.example](/Users/mukundhanmohan/Desktop/EADSS/eadss/.env.example).

Important environment variables:

- `DATABASE_URL`
- `REDIS_URL`
- `API_KEY`
- `API_KEY_PEPPER`
- `ADMIN_JWT_SECRET`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_KEY`

Config loading happens in [config.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/config.py) using `pydantic-settings`.

---

## 5. Backend Overview

## 5.1 Entry Point

The backend starts in [main.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/main.py).

Main responsibilities:

- create the FastAPI app
- configure CORS
- bootstrap a super admin user on startup if env vars are set
- install `UsageMiddleware`
- mount all API routes under `/api/v1`

## 5.2 CORS

Allowed origins default to:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `https://app.eadss.com`
- `https://eadss.com`
- `https://www.eadss.com`

They can be overridden with `CORS_ORIGINS`.

## 5.3 Middleware

`UsageMiddleware` measures request latency and, when an API key is present, records:

- org ID
- HTTP method
- request path
- response status
- latency in milliseconds

Usage data is written to `usage_events`.

---

## 6. Authentication and Authorization

There are **two auth systems** in the project.

## 6.1 API Key Auth for Client/API Access

Implemented in [security.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/security.py).

How it works:

- The client sends `X-API-Key`.
- The backend hashes the raw key with `API_KEY_PEPPER`.
- It looks up the hash in the `api_keys` table.
- If valid and active, the request gets a `ClientContext` containing:
  - `org_id`
  - `scopes`

Notes:

- Only the **hash** of the API key is stored in the DB.
- Plaintext keys are returned once when the org is created.

## 6.2 Admin Session Auth for Dashboard/Admin Flows

Implemented in [admin_auth.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/admin_auth.py).

How it works:

- Admins register or log in with email/password.
- Passwords are hashed with `pbkdf2_sha256`.
- A JWT session token is created.
- The token is stored in an HTTP-only cookie named `eadss_admin_session`.
- Protected endpoints use:
  - `require_admin`
  - `require_super_admin`

Notes:

- Cookie `secure=False` in current code, which is fine for local/dev but should be `True` behind HTTPS.
- Super-admin bootstrap can be created from env on startup.

---

## 7. Database Model

The backend uses SQLAlchemy ORM models in `backend/app/db/models`.

## 7.1 Source Data

### `documents`

Defined in [document.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/document.py).

Represents ingested events/tickets.

Main fields:

- `id`
- `external_id`
- `org_id`
- `team_id`
- `source`
- `channel`
- `tags`
- `text_redacted`
- `redaction_summary`
- `timestamp`
- `created_at`
- `updated_at`

Important design choice:

- Raw text is not stored.
- Only the redacted text is persisted.

### `inference_runs`

Defined in [inference.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/inference.py).

Tracks a batch inference execution.

Fields include:

- `model_name`
- `model_version`
- `status`
- `params`
- `summary`
- `started_at`
- `finished_at`

### `document_inference`

Also defined in [inference.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/inference.py).

Stores inference output per document.

Fields include:

- `document_id`
- `inference_run_id`
- `sentiment`
- `emotion_labels`
- `calibrated_confidence`
- `result`
- `created_at`

## 7.2 Aggregation and Alerting

### `emotion_daily`

Defined in [aggregations.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/aggregations.py).

Stores daily grouped counts/averages by:

- day
- org
- team
- channel
- source
- sentiment
- emotion

### `emotion_rolling`

Also defined in [aggregations.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/aggregations.py).

Stores rolling-window summaries for windows such as:

- 7 days
- 30 days
- 90 days

### `alerts`

Model name `AlertEvent`, defined in [aggregations.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/aggregations.py).

Stores generated alert events.

Fields include:

- `day`
- `alert_type`
- `severity`
- `org_id`
- `team_id`
- `channel`
- `metric`
- `value`
- `baseline`
- `message`

### `alert_rules`

Defined in [alerts.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/alerts.py).

Stores rule definitions in JSON.

Example conceptual payload:

```json
{
  "type": "risk_spike",
  "baseline_days": 30,
  "z_threshold": 3.5,
  "min_docs": 10,
  "keywords": ["outage", "refund", "angry"],
  "top_k_evidence": 10
}
```

### `alert_evidence`

Defined in [alerts.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/alerts.py).

Stores evidence objects attached to an alert.

Fields include:

- `alert_id`
- `document_id`
- `contribution`
- `emotion_match`
- `keyword_hits`
- `highlights`
- `created_at`

This is the core explainability table.

## 7.3 Org/Admin/Auth Data

### `organizations`

Defined in [org.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/org.py).

Stores:

- `org_id`
- `name`

### `api_keys`

Defined in [api_key.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/api_key.py).

Stores:

- hashed key
- org
- scopes
- active state

### `admin_users`

Defined in [admin_user.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/admin_user.py).

Stores:

- email
- password hash
- active flag
- super-admin flag

### `admin_memberships`

Defined in [admin_membership.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/admin_membership.py).

Links admin users to orgs.

## 7.4 Monitoring and Audit

### `usage_events`

Defined in [usage.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/usage.py).

Populated by middleware. Tracks:

- org
- method
- path
- status
- latency

### `audit_log`

Defined in [audit_log.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/audit_log.py).

Used by alert rule execution to log system actions.

## 7.5 Topic Modeling

### `topics`

Defined in [topic.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/topic.py).

Stores BERTopic-derived topic metadata per run.

### `document_topics`

Defined in [document_topic.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/db/models/document_topic.py).

Stores document-to-topic assignments.

---

## 8. API Surface

All backend APIs are mounted under `/api/v1`.

## 8.1 Health

### `GET /api/v1/health`

Returns:

```json
{"status":"ok"}
```

Defined in [health.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/health.py).

## 8.2 Ingestion

### `POST /api/v1/ingest/tickets`

Defined in [ingest.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/ingest.py).

Protected by API key auth.

Request schema:

```json
{
  "items": [
    {
      "text": "Customer is angry. Email me at jane@example.com.",
      "timestamp": "2026-05-11T09:00:00Z",
      "source": "api",
      "channel": "support",
      "tags": ["billing"],
      "org_id": "acme",
      "team_id": "support",
      "external_id": "TICK-123"
    }
  ],
  "enqueue_inference": true
}
```

Behavior:

1. redact PII
2. create `documents` rows
3. optionally create an `inference_run`
4. commit
5. enqueue `run_emotion_inference`

Response:

- inserted count
- document IDs
- redaction summary

## 8.3 Documents

### `GET /api/v1/documents`

Defined in [documents.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/documents.py).

Protected by API key auth.

Supports:

- pagination
- org/team/source/channel filtering
- external ID filtering
- tag filtering
- timestamp range filtering

Returns paginated redacted documents.

### `GET /api/v1/documents/{document_id}/inference`

Defined in [inference.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/inference.py).

Protected by API key auth.

Returns the latest `document_inference` row for the document.

## 8.4 Ticket Lookup

### `GET /api/v1/tickets/{external_id}`

Defined in [tickets.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/tickets.py).

Protected by API key auth.

Behavior:

- filters by `external_id`
- restricts to the caller’s `client.org_id`
- optionally filters by `team_id`
- returns the latest matching document and latest inference

This is the most tenant-scoped endpoint in the current backend.

## 8.5 Alerts

### `GET /api/v1/alerts`

Defined in [alerts.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/alerts.py).

Protected by API key auth.

Supports:

- `limit`
- `org_id`
- `team_id`
- `alert_type`
- `severity`

Returns alert summaries.

### `GET /api/v1/alerts/{alert_id}`

Defined in [alerts.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/alerts.py).

Protected by API key auth.

Returns:

- alert summary
- ranked evidence rows
- document preview text
- latest inference fields

## 8.6 Usage

### `GET /api/v1/usage?days=7`

Defined in [usage.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/usage.py).

Protected by API key auth.

Returns:

- daily request counts
- daily average latency
- top requested API paths

This endpoint uses the authenticated client org from the API key.

## 8.7 Admin Auth

Defined in [admin_auth.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/admin_auth.py).

Endpoints:

- `POST /api/v1/admin/register`
- `POST /api/v1/admin/login`
- `POST /api/v1/admin/super/login`
- `POST /api/v1/admin/logout`
- `GET /api/v1/admin/me`
- `GET /api/v1/admin/super/me`
- `GET /api/v1/admin/super/users`

Purpose:

- register/login admins
- issue session cookies
- expose super-admin inspection views

## 8.8 Organization Registration

### `POST /api/v1/orgs/register`

Defined in [orgs.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/orgs.py).

Requires admin cookie auth.

Behavior:

1. create `organizations` row
2. create admin membership
3. generate a new API key
4. hash and store it
5. return plaintext API key once

This endpoint is how the frontend onboarding flow issues org credentials.

---

## 9. Background Jobs and Scheduling

Celery is configured in [celery_app.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/celery_app.py).

## 9.1 Scheduled Jobs

Configured schedules:

- `topic_jobs.run_bertopic`
  - daily at `02:00 UTC`
- `aggregations.compute_emotion_daily`
  - daily at `00:10 UTC`
- `aggregations.compute_emotion_rolling`
  - daily at `00:20 UTC`
- `aggregations.detect_risk_spikes`
  - daily at `00:30 UTC`
- `alerting.run_rules`
  - daily at `00:40 UTC`

## 9.2 Inference Job

Implemented in [infer_docs.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/infer_docs.py).

Flow:

1. load the `InferenceRun`
2. mark it `running`
3. fetch the selected documents
4. run `predict_emotion(text_redacted)`
5. insert `DocumentInference` rows
6. mark the run `completed`

On failure:

- mark the run `failed`
- store the error in `summary`

## 9.3 Daily Aggregation

Implemented in [aggregations.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/aggregations.py).

### `compute_emotion_daily`

- groups document inference rows by UTC day and segment
- explodes `emotion_labels` into one row per emotion label
- populates `emotion_daily`

### `compute_emotion_rolling`

- computes rolling-window summaries from `emotion_daily`
- stores results in `emotion_rolling`

### `detect_risk_spikes`

- calculates negative-rate per segment
- compares current value to historical baseline
- uses median + MAD-based robust z-score
- inserts `alerts` rows for spikes

This is a statistical alert generator.

## 9.4 Rule Engine and Evidence Builder

Implemented in [alerting.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/alerting.py).

This is the richer explainability job.

What it does:

1. load enabled `alert_rules`
2. currently only handle rules where `definition.type == "risk_spike"`
3. compute segment-level negative-rate anomalies
4. create `AlertEvent` rows
5. audit alert creation
6. fetch candidate documents for the affected segment/day
7. score each document using:
   - negative sentiment match
   - target emotions
   - keyword hits
   - confidence
8. store top-k documents in `alert_evidence`

This is where explainability becomes concrete.

## 9.5 Topic Modeling

Implemented in [topic_jobs.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/topic_jobs.py).

Behavior:

- pull recent docs for an org/team/time window
- embed text using `SentenceTransformer("all-MiniLM-L6-v2")`
- cluster using BERTopic
- write topic metadata and document assignments

This part of the project is heavier and more experimental than the emotion pipeline.

---

## 10. Inference and Explainability Logic

## 10.1 PII Redaction

Implemented in [pii.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/pii.py).

Current redaction patterns:

- email addresses
- phone numbers

Output:

- `text_redacted`
- `summary = {"emails": n, "phones": n}`

This is a baseline redaction layer, not a full DLP solution.

## 10.2 Emotion Model

Implemented in [emotion.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/ml/models/emotion.py).

This is a lightweight lexicon-based model, not a transformer.

It:

- tokenizes lowercase word-like strings
- counts positive/negative keywords
- assigns emotions from keyword presence
- emits:
  - `sentiment`
  - `emotion_labels`
  - `calibrated_confidence`

Emotion labels currently include:

- `anger`
- `sadness`
- `fear`
- `fatigue`
- `joy`
- `neutral`

## 10.3 Explanation Helpers

Implemented in [explain.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/utils/explain.py).

Functions:

- `find_keyword_spans`
  - finds keyword matches
  - returns deduplicated hits + highlight spans
- `compute_contribution`
  - scores document contribution for evidence ranking
  - combines sentiment, emotion overlap, keyword hits, and confidence

These helpers feed the evidence ranking logic in the rule engine.

---

## 11. Synthetic Data and Demo Support

## 11.1 Synthetic Data Generator

Implemented in [synthetic_data.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/utils/synthetic_data.py).

It generates:

- varied positive/negative/neutral texts
- fake email addresses
- fake phone numbers
- random channel/source/tag metadata
- recent timestamps

This is useful for:

- demos
- local validation
- loading non-sensitive example datasets

## 11.2 Batch Loader Script

Defined in [load_synth_data.sh](/Users/mukundhanmohan/Desktop/EADSS/eadss/scripts/load_synth_data.sh).

It:

- generates synthetic payloads inside the backend container
- posts them to `/api/v1/ingest/tickets`
- supports batch loading

Useful env vars:

- `API_BASE_URL`
- `API_KEY`
- `TOTAL`
- `BATCH`
- `ORG_ID`
- `TEAM_ID`
- `ENQUEUE_INFERENCE`
- `SEED`

---

## 12. Frontend Overview

The frontend is a Next.js app in `frontend/`.

Dependencies are small:

- Next.js 14
- React 18
- Recharts
- TypeScript

## 12.1 Frontend API Client

Implemented in [api.ts](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/lib/api.ts).

It handles:

- base API URL selection
- API key headers
- admin cookie-based fetches
- response error normalization

It uses:

- `X-API-Key` for API-key protected routes
- `credentials: "include"` for admin-auth routes

## 12.2 Frontend Page Categories

The frontend currently falls into **three categories**:

### A. Public Demo Pages

These are mostly sample/demo-driven:

- `/`
- `/dashboard`
- `/alerts`
- `/alerts/[id]`
- `/api-docs`

Characteristics:

- product marketing/demo experience
- sample analytics
- public alert showcase
- no strict dependency on live backend data for main content

### B. Authenticated Onboarding/Admin Pages

- `/login`
- `/try-now`
- `/register`
- `/super-admin/users`

Characteristics:

- admin cookie auth
- org creation
- API key issuance
- super-admin inspection

### C. Org-Specific Data Pages

- `/org/[orgId]/dashboard`
- `/org/[orgId]/usage`

Characteristics:

- use real backend APIs
- set active org in `localStorage`
- pull live documents/inference/usage for that org

---

## 13. Frontend Pages in Detail

## 13.1 Home Page

Defined in [page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/page.tsx).

What it does:

- product landing page
- checks whether admin session exists
- offers a local in-browser text demo
- presents product positioning and sample recommendation output

Important note:

- The “Analyze Text” behavior here is **frontend-only demo logic**, not a real backend API call.

## 13.2 Public Dashboard

Defined in [dashboard/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/dashboard/page.tsx).

What it does:

- renders sample trend charts using Recharts
- shows KPI cards
- uses hardcoded sample data

This is a **public showcase page**, not a live operational dashboard.

## 13.3 Public Alerts

Defined in:

- [alerts/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/alerts/page.tsx)
- [alerts/[id]/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/alerts/[id]/page.tsx)

What they do:

- display sample alerts
- filter them locally
- show evidence cards with highlighted spans

These pages currently rely on `demoData`, not backend alert APIs.

## 13.4 API Docs Page

Defined in [api-docs/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/api-docs/page.tsx).

What it does:

- embeds backend Swagger UI in an `<iframe>`
- points to `${NEXT_PUBLIC_API_BASE_URL}/docs`

## 13.5 Login / Registration

Defined in [login/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/login/page.tsx).

What it does:

- sign in
- create admin account
- validate password rules client-side
- write a local “logged in” hint to `localStorage`
- redirect to onboarding

## 13.6 Try Now

Defined in [try-now/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/try-now/page.tsx).

This is the guided onboarding page.

It walks the user through:

1. creating an org
2. storing API credentials
3. embedding the API in code
4. checking dashboards/docs

If the session is invalid, it redirects to `/login`.

## 13.7 Register Organization

Defined in [register/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/register/page.tsx).

What it does:

- requires admin session
- calls `POST /api/v1/orgs/register`
- shows plaintext API key once
- stores the API key in `localStorage`
- stores org activity log per admin user in `localStorage`

## 13.8 Org Dashboard

Defined in [org/[orgId]/dashboard/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/org/[orgId]/dashboard/page.tsx).

This is one of the important **live-data pages**.

What it does:

1. set active org in `localStorage`
2. fetch documents for the last 14 days
3. fetch latest inference for each document
4. build day-wise emotion counts in the browser
5. render a stacked area chart

This page composes live data client-side from multiple API calls.

## 13.9 Org Usage Page

Defined in [org/[orgId]/usage/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/org/[orgId]/usage/page.tsx).

What it does:

- sets active org in `localStorage`
- calls `GET /api/v1/usage`
- shows request counts, average latency, and top paths

## 13.10 Super Admin Users

Defined in [super-admin/users/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/super-admin/users/page.tsx).

What it does:

- requires super-admin session
- fetches `/api/v1/admin/super/users`
- shows:
  - admin users
  - password hashes
  - memberships
  - API key hashes

This is a privileged internal inspection page.

---

## 14. End-to-End Request Flows

## 14.1 Ticket Ingestion Flow

```text
Client
  -> POST /api/v1/ingest/tickets
  -> API key auth
  -> redact PII
  -> insert documents
  -> create inference_run (optional)
  -> enqueue Celery inference task
  -> return inserted document IDs
```

## 14.2 Inference Flow

```text
Celery worker
  -> load inference_run
  -> mark run running
  -> read redacted documents
  -> run lexical emotion model
  -> write document_inference rows
  -> mark run completed
```

## 14.3 Alerting Flow

```text
Celery beat
  -> compute_emotion_daily
  -> compute_emotion_rolling
  -> detect_risk_spikes
  -> run_rules
  -> create alerts
  -> attach evidence documents + highlights
```

## 14.4 Org Dashboard Flow

```text
Frontend org dashboard
  -> GET /documents
  -> GET /documents/{id}/inference for each doc
  -> aggregate counts client-side
  -> render stacked area chart
```

## 14.5 Usage Analytics Flow

```text
Frontend usage page
  -> GET /usage
  -> backend reads usage_events for authenticated org
  -> frontend renders totals and endpoint rankings
```

---

## 15. Alembic and Schema Evolution

Database migrations live in `backend/alembic/versions`.

Migration history shows the project evolved to include:

- initial core tables
- inference output fields
- usage events
- orgs and API keys
- alert rules and evidence
- aggregation tables
- admin users and memberships
- topic modeling tables
- document ingestion fields

This is useful context for understanding which parts are mature and which parts were added later.

---

## 16. Deployment Model

There is a deployment runbook at [docs_AWS_DEPLOY.md](/Users/mukundhanmohan/Desktop/EADSS/eadss/docs_AWS_DEPLOY.md).

The intended deployment path is:

- GitHub source
- one AWS EC2 instance
- Docker Compose on the host
- GoDaddy DNS
- Nginx reverse proxy
- Let’s Encrypt TLS

Suggested hardening in the project docs includes:

- move Postgres to RDS
- move Redis to ElastiCache
- add CloudWatch alarms
- use WAF/backups

---

## 17. Important Current Behaviors and Caveats

This section is documentation, not a code review, but these are important to understand because they affect how the system currently behaves.

## 17.1 Demo vs Live Product Split

The frontend is partly a live application and partly a public demo.

Live/API-backed areas:

- admin login
- org registration
- org dashboard
- org usage
- embedded API docs

Demo/sample-data areas:

- landing page analysis demo
- public dashboard
- public alerts feed
- public alert detail

## 17.2 Emotion Inference Is Heuristic

The production inference path currently uses a simple lexicon-based classifier, not a large ML model. That makes it:

- fast
- easy to understand
- easy to demo

But also:

- limited in nuance
- sensitive to vocabulary coverage
- not appropriate to describe as a state-of-the-art NLP model

## 17.3 Multi-Tenancy Enforcement Is Mixed

Some endpoints explicitly scope by authenticated org, while others mainly check that an API key exists and then rely on query params or object IDs.

Strongly org-scoped examples:

- `/tickets/{external_id}`
- `/usage`

More weakly scoped in current code:

- `/documents`
- `/documents/{id}/inference`
- `/alerts`
- `/alerts/{id}`

Anyone extending this system should treat tenant isolation as an area that needs careful review.

## 17.4 Security Defaults Are Dev-Friendly

Examples:

- admin cookie uses `secure=False`
- demo keys/secrets exist in `.env.example`
- frontend stores some tokens and org logs in `localStorage`

That is acceptable for local development, but production hardening is still needed.

## 17.5 Topic Modeling Is Present but Not Fully Surfaced

The backend has BERTopic task support and topic tables, but the frontend does not appear to expose full topic exploration yet. This is a partially integrated capability.

---

## 18. How To Run the Project Locally

## 18.1 Basic Startup

From the project root:

```bash
cd /Users/mukundhanmohan/Desktop/EADSS/eadss
cp .env.example .env
docker compose up -d --build
```

Expected local ports:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

## 18.2 Useful Local Pages

- Home: `http://localhost:3000/`
- Public dashboard: `http://localhost:3000/dashboard`
- Public alerts: `http://localhost:3000/alerts`
- API docs page: `http://localhost:3000/api-docs`
- Raw backend Swagger: `http://localhost:8000/docs`

## 18.3 Local Data Loading

Use the synthetic data script:

```bash
cd /Users/mukundhanmohan/Desktop/EADSS/eadss
API_BASE_URL=http://localhost:8000 \
API_KEY=dev-local-key \
TOTAL=50 \
BATCH=5 \
ORG_ID=demo \
TEAM_ID=support \
ENQUEUE_INFERENCE=true \
./scripts/load_synth_data.sh
```

---

## 19. How the Pieces Fit Together

If you want the simplest mental model, think of EADSS as five layers:

1. **Collection**
   - APIs receive enterprise text data.
2. **Protection**
   - PII redaction happens before persistence.
3. **Interpretation**
   - background jobs infer sentiment/emotion.
4. **Decisioning**
   - scheduled jobs compute aggregates and detect risk spikes.
5. **Explanation + Delivery**
   - alerts are enriched with evidence and surfaced in APIs/UI.

That is the fundamental operating model of the entire project.

---

## 20. File Reference Map

Backend core:

- [main.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/main.py)
- [router.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/router.py)
- [config.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/config.py)
- [security.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/security.py)
- [admin_auth.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/admin_auth.py)
- [pii.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/core/pii.py)

Key backend flows:

- [ingest.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/ingest.py)
- [infer_docs.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/infer_docs.py)
- [aggregations.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/aggregations.py)
- [alerting.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/alerting.py)
- [emotion.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/ml/models/emotion.py)
- [explain.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/utils/explain.py)

Frontend core:

- [api.ts](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/lib/api.ts)
- [page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/page.tsx)
- [dashboard/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/dashboard/page.tsx)
- [alerts/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/alerts/page.tsx)
- [register/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/register/page.tsx)
- [org/[orgId]/dashboard/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/org/[orgId]/dashboard/page.tsx)
- [org/[orgId]/usage/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/org/[orgId]/usage/page.tsx)

---

## 21. Summary

EADSS is a containerized explainable AI decision-support platform focused on enterprise text workflows.

Its real implementation today is:

- **FastAPI** for APIs
- **PostgreSQL** for persistence
- **Redis + Celery** for background jobs
- **Next.js** for product/demo/admin UI

Its main operational loop is:

- ingest text
- redact PII
- infer sentiment/emotion
- aggregate over time
- detect risk spikes
- attach evidence
- expose explainable alerts and analytics

If you want to understand the system quickly, start with:

1. [ingest.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/api/v1/endpoints/ingest.py)
2. [infer_docs.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/infer_docs.py)
3. [aggregations.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/aggregations.py)
4. [alerting.py](/Users/mukundhanmohan/Desktop/EADSS/eadss/backend/app/tasks/alerting.py)
5. [api.ts](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/lib/api.ts)
6. [org/[orgId]/dashboard/page.tsx](/Users/mukundhanmohan/Desktop/EADSS/eadss/frontend/src/app/org/[orgId]/dashboard/page.tsx)

That path will give you the clearest end-to-end understanding of how the project works.
