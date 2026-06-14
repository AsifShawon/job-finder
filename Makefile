COMPOSE_LOCAL=docker compose --env-file .env.local -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local.yml

up:
	$(COMPOSE_LOCAL) up --build

down:
	$(COMPOSE_LOCAL) down

logs:
	$(COMPOSE_LOCAL) logs -f

migrate:
	$(COMPOSE_LOCAL) exec api alembic upgrade head

seed:
	$(COMPOSE_LOCAL) exec api python /workspace/scripts/seed.py

create-admin:
	$(COMPOSE_LOCAL) exec api python /workspace/scripts/create_admin.py

worker:
	$(COMPOSE_LOCAL) exec worker celery -A worker.celery_app:celery_app worker --loglevel=INFO --pool=solo --concurrency=1

beat:
	$(COMPOSE_LOCAL) exec beat celery -A worker.celery_app:celery_app beat --loglevel=INFO

reindex:
	$(COMPOSE_LOCAL) exec api python /workspace/scripts/reindex_embeddings.py
