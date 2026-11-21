# Mello matching AI

Internal FastAPI service, with `api/` routes/controllers/schemas/dependencies and reusable `ai/` services/repositories/providers. Only package structure was referenced from the existing ai-bot project.

For the full backend stack, run `docker compose up --build` from `backend/`. The Python service starts alongside Node inside the backend container and listens on container loopback.

To develop the Python service on its own, run from this directory:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt
$env:MATCHING_AI_KEY = '<independent random secret, at least 32 characters>'
.venv/Scripts/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Node: set the same `MATCHING_AI_KEY`, `MATCHING_AI_URL=http://127.0.0.1:8000`, and `MATCHING_MODE=HYBRID`. Apply the new backend migration before using ranked feeds. No provider account is required for local sentence-transformer inference.

For real embeddings, install `requirements-embeddings.txt`, set `AI_EMBEDDINGS_ENABLED=true`, and provision the model indicated by `AI_EMBEDDING_MODEL` plus a pinned `AI_MODEL_REVISION`. `AI_MODEL_LOCAL_ONLY=true` prevents implicit model downloads. Use false intentionally when first provisioning the model. Model quality on Hindi/Hinglish must be evaluated with real examples; unit tests use a fake encoder.

The runtime defaults to this project's `.cache/huggingface/hub`; override `AI_MODEL_CACHE_DIR` for a mounted cache. `requirements-embeddings.lock.txt` records the locally tested dependency versions. To explicitly provision and exercise the real public multilingual model through the FastAPI contract, run `.venv/Scripts/python scripts/evaluate_semantics.py --download`. Subsequent offline runs can use `--revision <commit-from-report>` without `--download`. The report is saved in `.cache/semantic-smoke.json`; three semantic smoke cases are not a dating-outcome benchmark.

Endpoints:

- `GET /health`: process health.
- `GET /ready`: 200 when embeddings are loaded; 503 otherwise.
- `POST /v1/matching/semantic`: `{viewerText,candidates:[{key:<uuid>,text}]}`; returns versioned similarity values in [0,1].
- `POST /v1/assist/icebreakers`: `{sharedInterests:[...]}`; returns grounded template drafts, not LLM-generated claims.

Both POST routes require `X-Service-Key`. Requests are strictly validated and size-limited. Validation responses omit raw input. Model errors return safe 503 responses. Public OpenAPI/docs are disabled. Keep the service private; end-user authorization/eligibility/consent remain in Node.

Profiles, chat history and vectors are not persisted or logged by application code. Inference batches deduplicate text only within that request; revocation cannot leave a stale cross-request embedding cache. Model weights may be cached independently of user data. One model instance is loaded per process; a busy inference worker returns 503 rather than growing a work queue. Configure worker counts and CPU/memory based on measured model load.

Tests (with existing FastAPI/httpx dependencies, no model download):

```powershell
python -m unittest discover -s tests -v
```

Detailed algorithm, API contracts, scope boundaries and deployment notes: `../backend/docs/matching.md`.
