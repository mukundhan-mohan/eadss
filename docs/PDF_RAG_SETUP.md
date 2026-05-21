# PDF RAG Setup

This document explains how to run the PDF upload + local-embedding question answering feature added to EADSS.

## What the feature does

Flow:

```text
Upload PDF
-> background text extraction
-> chunk text
-> local embeddings
-> store vectors in PostgreSQL with pgvector
-> ask question
-> retrieve similar chunks
-> return answer + evidence
```

## What changed in infrastructure

The runtime was updated so this feature can actually work:

- Postgres image changed to `pgvector/pgvector:pg16`
- backend and worker now share a persistent Docker volume for uploaded PDFs
- new PDF-related environment variables were added to `.env.example`

Relevant files:

- [docker-compose.yml](/Users/mukundhanmohan/Desktop/EADSS/eadss/docker-compose.yml)
- [.env.example](/Users/mukundhanmohan/Desktop/EADSS/eadss/.env.example)

## Environment variables

These are now used by the feature:

- `PDF_UPLOAD_DIR`
  - default: `/app/data/pdf_uploads`
- `PDF_EMBEDDING_MODEL`
  - default: `all-MiniLM-L6-v2`
- `PDF_CHUNK_WORDS`
  - default: `180`
- `PDF_CHUNK_OVERLAP_WORDS`
  - default: `30`

## First-time startup

From the project root:

```bash
cd /Users/mukundhanmohan/Desktop/EADSS/eadss
cp .env.example .env
docker compose down
docker compose up -d --build
```

If you already had an old Postgres container running from `postgres:16-alpine`, this restart is important so Docker recreates the service with the `pgvector` image.

## Run migrations

After the stack is up, apply DB migrations:

```bash
docker compose exec backend alembic upgrade head
```

The PDF RAG migration creates:

- `pdf_documents`
- `pdf_chunks`
- `vector` extension
- vector similarity index

## Containers involved

This feature depends on:

- `postgres`
  - stores chunk vectors via `pgvector`
- `backend`
  - upload/list/ask endpoints
- `worker`
  - PDF extraction, chunking, local embedding generation
- `redis`
  - Celery broker

The `backend` and `worker` both mount:

```text
pdf_uploads:/app/data
```

That shared volume matters because:

- the API stores the uploaded PDF file
- the worker later reads the same file for processing

## API endpoints

### Upload a PDF

```bash
curl -X POST "http://localhost:8000/api/v1/pdf/upload" \
  -H "X-API-Key: dev-local-key" \
  -F "file=@/absolute/path/to/file.pdf" \
  -F "title=Policy Handbook"
```

Response shape:

- document ID
- filename/title
- status

Initial status will usually be:

- `uploaded`
- then `processing`
- then `ready`

### List PDFs

```bash
curl "http://localhost:8000/api/v1/pdf/documents" \
  -H "X-API-Key: dev-local-key"
```

### Get one PDF status

```bash
curl "http://localhost:8000/api/v1/pdf/documents/<document_id>" \
  -H "X-API-Key: dev-local-key"
```

### Ask a question

```bash
curl -X POST "http://localhost:8000/api/v1/pdf/ask" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-local-key" \
  -d '{
    "document_id": "<document_id>",
    "question": "What is the cancellation policy?",
    "top_k": 5
  }'
```

Response includes:

- `answer`
- `evidence`
  - chunk ID
  - document ID
  - document title
  - page number
  - chunk index
  - similarity score
  - excerpt

## Processing lifecycle

### 1. Upload

The backend:

- validates API key
- validates the file is a PDF
- writes the file to `PDF_UPLOAD_DIR`
- creates a `pdf_documents` row
- queues a Celery task

### 2. Background processing

The worker:

- reads the PDF file
- extracts page text with `pypdf`
- splits text into chunks
- generates local embeddings with `sentence-transformers`
- stores chunk vectors in `pdf_chunks`
- marks the document `ready`

### 3. Retrieval and answering

When you call `/api/v1/pdf/ask`:

- the question is embedded locally
- top matching chunks are retrieved with pgvector similarity search
- the backend returns an extractive answer based on the best matching sentences
- evidence is returned with page-level provenance

## Monitoring and debugging

### Watch worker logs

```bash
docker compose logs -f worker
```

### Watch backend logs

```bash
docker compose logs -f backend
```

### Check document status in Postgres

```bash
docker compose exec postgres psql -U eadss -d eadss
```

Then:

```sql
SELECT id, org_id, filename, status, page_count, chunk_count, error_message, created_at
FROM pdf_documents
ORDER BY created_at DESC;
```

### Check stored chunks

```sql
SELECT document_id, page_number, chunk_index, left(text, 120) AS excerpt
FROM pdf_chunks
ORDER BY created_at DESC
LIMIT 20;
```

## Operational notes

- The answer generation is currently extractive, not LLM-generated.
- Embeddings are local via `sentence-transformers`, so no embedding API key is required.
- The first run may take longer because the embedding model may need to download into the container environment.
- Large PDFs will create many chunks, so retrieval/storage costs still exist even without an external embeddings API.

## If something fails

Common checks:

1. Did the DB service restart with the `pgvector/pgvector:pg16` image?
2. Did migrations run successfully?
3. Is the worker running?
4. Did the uploaded document status move to `failed`?
5. Do worker logs show model-download or PDF parsing errors?

If needed, inspect failed documents:

```sql
SELECT id, filename, status, error_message
FROM pdf_documents
WHERE status = 'failed'
ORDER BY created_at DESC;
```
