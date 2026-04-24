# Deployment

## Local with Docker Compose
1. `docker compose -f infrastructure/docker-compose.yml up --build`
2. Run migration and seed commands.
3. Verify health:
   - API: `GET /health`, `GET /ready`
   - Flower: `http://localhost:5555`

## Production Notes
- Replace `.env` secrets with secure secret manager.
- Run API behind reverse proxy and TLS.
- Use managed Postgres with pgvector enabled.
- Scale worker/beat separately from API.
- Configure object lifecycle policies for snapshots.
- Enable centralized JSON log aggregation.

## Reliability
- Celery task retries with exponential backoff.
- Idempotent ingestion via dedupe checks.
- Source frequency controls to avoid over-crawling.
