# Overseas Opportunity Intelligence Platform for Bangladeshis

Production-oriented monorepo for ingesting, ranking, and serving verified overseas opportunities (jobs, scholarships, policy updates) with bounded AI assistance.

## Stack
- Frontend: Next.js App Router + TypeScript + Tailwind + shadcn-style components
- Backend: FastAPI + SQLAlchemy 2 + Alembic + Pydantic v2
- AI orchestration: LangChain + Groq API
- Database: PostgreSQL 16 + pgvector
- Workers: Celery + Redis + Celery Beat + Flower
- Ingestion: httpx/requests + BeautifulSoup + Playwright + Trafilatura
- Object storage: MinIO (S3-compatible) with local fallback
- Tests: pytest + Playwright

## Monorepo
- apps/web: Next.js frontend
- apps/api: FastAPI API + ingestion services
- apps/worker: Celery worker + beat tasks
- packages/shared-types: shared TypeScript types
- infrastructure: docker-compose and init SQL
- docs: architecture, end-to-end flow, data model, API, ingestion flow, deployment, runtime services
- scripts: seed, admin creation, reindex

## Core Documentation
- End-to-end admin-to-user flow: [`docs/end-to-end-admin-to-user-flow.md`](docs/end-to-end-admin-to-user-flow.md)
- Runtime services: [`docs/runtime-services.md`](docs/runtime-services.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)

## Quick Start
1. Copy env files:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env`
2. Start stack:
   - `docker compose -f infrastructure/docker-compose.yml up --build`
3. Run migrations:
   - `docker compose -f infrastructure/docker-compose.yml exec api alembic upgrade head`
4. Seed data:
   - `docker compose -f infrastructure/docker-compose.yml exec api python /workspace/scripts/seed.py`
5. Open services:
   - Web: http://localhost:3000
   - API docs: http://localhost:8000/docs
   - Flower: http://localhost:5555
   - MinIO console: http://localhost:9001

## Useful Commands
- `make up`
- `make migrate`
- `make seed`
- `make create-admin`
- `make reindex`

## Security and Guardrails
- JWT access + refresh tokens
- Argon2 password hashing
- CORS and server-side validation
- Copilot rate-limited endpoints
- Copilot only answers from indexed DB records
- Every copilot answer includes source evidence metadata

## V1 Scope
- Auth
- Source registry + crawl orchestration
- Deterministic ingestion + strict AI extraction
- Hybrid search with trust-aware ranking
- Save opportunities + alerts
- Bounded copilot
- Admin operations dashboard routes
