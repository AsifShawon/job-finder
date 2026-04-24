# Architecture

## Product Principle
- Data product first, AI product second.
- Official sources outrank commercial and news-only sources.
- AI extraction and explanation are bounded by deterministic validators and source evidence.

## System Components
- Web app (`apps/web`): search, filtering, details, saved, alerts, copilot, admin UX.
- API (`apps/api`): auth, search, copilot, admin, ingestion orchestration endpoints.
- Worker (`apps/worker`): Celery tasks for crawl scheduling, ingestion execution, embeddings, alerts, stale cleanup.
- Postgres + pgvector: transactional storage + lexical + semantic retrieval.
- Redis: Celery broker/result backend.
- MinIO: raw snapshot storage with local file fallback.

## Key Flows
1. Beat schedules active sources according to per-source frequency.
2. Connector fetches source pages (API/RSS/HTML/dynamic/PDF).
3. Cleaner normalizes content and stores raw snapshots.
4. LLM extraction returns strict structured payload.
5. Validators perform deterministic checks + dedupe + scoring.
6. Opportunity is persisted and indexed (TSVector + pgvector embedding).
7. Search endpoint executes hybrid retrieval + trust-weighted ranking.
8. Copilot retrieves only DB records and returns evidence-backed response.

## Non-goals V1
- No autonomous multi-agent browsing.
- No external vector DB.
- No microservice split beyond web/api/worker packages.
