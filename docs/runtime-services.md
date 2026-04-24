# Runtime Services

This project runs as a Docker Compose stack in [`infrastructure/docker-compose.yml`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/infrastructure/docker-compose.yml). In Docker Desktop, the top-level `infrastructure` row is the Compose project group, not an application container by itself.

## Service Map

| Compose service | Container | Port(s) | What it does | Needed for |
| --- | --- | --- | --- | --- |
| `postgres` | `ooi_postgres` | `5432` | Primary relational database with `pgvector` and text search indexes. | Required |
| `redis` | `ooi_redis` | `6379` | Celery broker and result backend. | Required for async jobs |
| `minio` | `ooi_minio` | `9000`, `9001` | S3-compatible object storage for raw crawl snapshots. | Optional locally |
| `api` | `ooi_api` | `8000` | FastAPI backend for auth, search, admin, copilot, and ingestion orchestration. | Required for backend/API |
| `worker` | `ooi_worker` | none | Celery worker that executes queued background jobs. | Required for async execution |
| `beat` | `ooi_beat` | none | Celery Beat scheduler for recurring jobs. | Required for automation only |
| `flower` | `ooi_flower` | `5555` | Celery monitoring dashboard. | Optional |
| `web` | `ooi_web` | `3000` | Next.js frontend. | Required for UI |

## How Each Service Is Used

### `postgres` / `ooi_postgres`

This is the system of record.

- The API reads and writes users, sources, crawl jobs, raw documents, opportunities, alerts, saved items, and refresh tokens.
- Alembic migrations create the schema and enable `vector` and `pg_trgm`.
- Search uses Postgres full-text search (`search_tsv`) and semantic vector storage in `opportunity_embeddings`.
- The worker also writes crawl job state, extracted opportunities, embeddings, and alert events.

Relevant code:

- Schema and extensions: [`apps/api/alembic/versions/20260424_0001_initial.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/alembic/versions/20260424_0001_initial.py)
- Search and vector similarity: [`apps/api/app/services/search_service.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/app/services/search_service.py)
- Ingestion writes opportunities and embeddings: [`apps/api/app/ingestion/pipeline.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/app/ingestion/pipeline.py)

If this container is down, the API is effectively unusable.

### `redis` / `ooi_redis`

Redis is not the main app database here. It exists to support Celery.

- `worker` uses it as the Celery broker.
- `worker` also uses it as the Celery result backend.
- `beat` publishes scheduled jobs into Redis.
- `flower` reads task state through Redis.
- The API needs Redis indirectly when admin endpoints call `.delay(...)` to queue a crawl or reindex task.

Relevant code:

- Celery broker/backend config: [`apps/worker/worker/celery_app.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/worker/worker/celery_app.py)
- Admin endpoints that queue tasks: [`apps/api/app/api/v1/endpoints/admin.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/app/api/v1/endpoints/admin.py)

If Redis is down:

- Normal API reads like search and detail pages can still work if Postgres is up.
- Background work cannot be queued or processed.
- Admin-triggered crawl/reindex actions will fail or stall.

### `minio` / `ooi_minio`

MinIO stores raw snapshots of fetched source content.

- During ingestion, the pipeline stores raw HTML or text before structured extraction.
- The storage layer writes to an S3-compatible bucket named `raw-docs`.
- If MinIO is unavailable, the code falls back to local filesystem storage under `/workspace/data/raw`.

Relevant code:

- Snapshot storage logic: [`apps/api/app/services/storage_service.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/app/services/storage_service.py)
- Ingestion pipeline usage: [`apps/api/app/ingestion/pipeline.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/app/ingestion/pipeline.py)

This makes MinIO optional for local development. It is useful when you want local behavior to match production-style object storage. If it is down, ingestion can still continue via the fallback path.

### `api` / `ooi_api`

This is the main backend service.

- Serves REST endpoints under `/api/v1`.
- Handles auth, opportunity search, details, saved items, alerts, copilot, and admin endpoints.
- Connects to Postgres directly on request paths.
- Queues background tasks through Celery when admin actions request crawl or reindex.
- Supplies MinIO configuration to ingestion/storage code.

Relevant code:

- App setup and health endpoints: [`apps/api/app/main.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/app/main.py)
- API routing: [`apps/api/app/api/v1/router.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/api/app/api/v1/router.py)

If this container is down, the web UI cannot talk to the backend and Docker-only local development is mostly blocked.

### `worker` / `ooi_worker`

This is the background executor.

- Executes source crawls.
- Runs ingestion and extraction.
- Rebuilds search indexes and embeddings for opportunities.
- Generates alert events.
- Cleans up stale opportunities.

Relevant code:

- Task definitions: [`apps/worker/worker/tasks.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/worker/worker/tasks.py)

If this container is stopped:

- Scheduled jobs will not actually execute.
- Manual admin actions that queue tasks will sit in Redis until a worker starts.
- Existing data can still be searched and viewed through the API/web.

### `beat` / `ooi_beat`

This is the recurring scheduler.

It does not perform the work itself. It only publishes scheduled tasks for the worker to consume.

Current schedules:

- Every 5 minutes: `schedule_active_source_crawls`
- Every 10 minutes: `generate_alert_events`
- Every 6 hours: `cleanup_stale_opportunities`

Relevant code:

- Beat schedule configuration: [`apps/worker/worker/celery_app.py`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/worker/worker/celery_app.py)

If this container is stopped:

- Automatic crawls stop.
- Automatic alert generation stops.
- Automatic stale-opportunity cleanup stops.
- Manual task triggering can still work if `worker` and `redis` are running.

### `flower` / `ooi_flower`

Flower is an operator dashboard for Celery.

- Lets you inspect workers, queues, and task activity in the browser.
- It does not serve the product to end users.
- It does not execute jobs.

Relevant config:

- Compose definition: [`infrastructure/docker-compose.yml`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/infrastructure/docker-compose.yml)

If this container is stopped, nothing functional in the product breaks. You only lose visibility into task processing.

### `web` / `ooi_web`

This is the Next.js frontend.

- Renders the search UI, auth pages, saved items, alerts, copilot UI, and admin pages.
- Calls the backend through `NEXT_PUBLIC_API_BASE_URL`, which is set to `http://localhost:8000` in Compose.

Relevant code:

- Frontend API base: [`apps/web/lib/api.ts`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/apps/web/lib/api.ts)
- Compose env for web: [`infrastructure/docker-compose.yml`](/c:/Users/User/Documents/FleekBD/Porjects/job-finder/infrastructure/docker-compose.yml)

If this container is stopped, the backend still exists, but you lose the browser UI at `http://localhost:3000`.

## What Is Actually Required

### Minimum stack for backend-only development

- `postgres`
- `api`

### Minimum stack for normal UI usage

- `postgres`
- `api`
- `web`

### Minimum stack for manual background-task testing

- `postgres`
- `api`
- `redis`
- `worker`
- `web` if you want to trigger actions from the frontend

### Full local stack with automation

- `postgres`
- `redis`
- `minio` optional but recommended
- `api`
- `worker`
- `beat`
- `web`
- `flower` optional

## What Your Screenshot Likely Means

From the screenshot:

- Running: `ooi_postgres`, `ooi_redis`, `ooi_minio`, `ooi_api`, `ooi_web`
- Stopped: `ooi_worker`, `ooi_beat`, `ooi_flower`

That means:

- The frontend and API should still load.
- Existing data in Postgres should still be searchable.
- Scheduled crawls, alert generation, and cleanup jobs are not running.
- If you trigger a crawl or reindex from the admin API/UI, the job may be queued into Redis but will not be executed until `ooi_worker` starts.
- Flower monitoring is unavailable, but that is not a product issue.

## Practical Recommendation

For day-to-day frontend or API development, you usually do not need every service all the time.

- Keep `postgres`, `api`, and `web` running for general product work.
- Start `redis` and `worker` when testing crawl, reindex, or alert pipelines.
- Start `beat` only when you want recurring automation.
- Start `flower` only when you need queue visibility.
- Keep `minio` on if you want S3-compatible snapshot storage; otherwise the local fallback is acceptable for dev.
