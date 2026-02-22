#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-dev-local-key}"

# Total items and batch size
TOTAL="${TOTAL:-50}"
BATCH="${BATCH:-5}"

# Demo metadata
ORG_ID="${ORG_ID:-demo}"
TEAM_ID="${TEAM_ID:-support}"

# Inference toggle: true/false
ENQUEUE_INFERENCE="${ENQUEUE_INFERENCE:-true}"

# Seed for reproducibility (optional)
SEED="${SEED:-}"

echo "Loading synthetic data into ${API_BASE_URL}"
echo "TOTAL=${TOTAL} BATCH=${BATCH} ORG_ID=${ORG_ID} TEAM_ID=${TEAM_ID} ENQUEUE_INFERENCE=${ENQUEUE_INFERENCE}"

# Convert ENQUEUE_INFERENCE into generator flag
NO_INFER_FLAG=""
if [[ "${ENQUEUE_INFERENCE}" == "false" ]]; then
  NO_INFER_FLAG="--no-infer"
fi

# How many batches
if (( TOTAL % BATCH == 0 )); then
  NUM_BATCHES=$(( TOTAL / BATCH ))
else
  NUM_BATCHES=$(( TOTAL / BATCH + 1 ))
fi

for ((i=1; i<=NUM_BATCHES; i++)); do
  # last batch size
  remaining=$(( TOTAL - (i-1)*BATCH ))
  if (( remaining <= 0 )); then
    break
  fi
  n=$BATCH
  if (( remaining < BATCH )); then
    n=$remaining
  fi

  # Create JSON payload via backend module, executed inside the backend container
  # so it always has the same environment and code.
  if [[ -n "${SEED}" ]]; then
    payload=$(docker compose exec -T backend bash -lc "python -m app.utils.synthetic_data --n ${n} --org ${ORG_ID} --team ${TEAM_ID} --seed ${SEED} ${NO_INFER_FLAG}")
  else
    payload=$(docker compose exec -T backend bash -lc "python -m app.utils.synthetic_data --n ${n} --org ${ORG_ID} --team ${TEAM_ID} ${NO_INFER_FLAG}")
  fi

  echo "Batch ${i}/${NUM_BATCHES}: ingesting ${n} items..."
  curl -sS "${API_BASE_URL}/api/v1/ingest/tickets" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d "${payload}" >/dev/null

done

echo "Done."
echo "Tip: check docs count:"
echo "  curl -H \"X-API-Key: ${API_KEY}\" \"${API_BASE_URL}/api/v1/documents?limit=10\""