COMPOSE_FILE=infrastructure/docker-compose.yml

up:
docker compose -f $(COMPOSE_FILE) up --build

down:
docker compose -f $(COMPOSE_FILE) down -v

logs:
docker compose -f $(COMPOSE_FILE) logs -f

migrate:
docker compose -f $(COMPOSE_FILE) exec api alembic upgrade head

seed:
docker compose -f $(COMPOSE_FILE) exec api python /workspace/scripts/seed.py

create-admin:
docker compose -f $(COMPOSE_FILE) exec api python /workspace/scripts/create_admin.py

worker:
docker compose -f $(COMPOSE_FILE) exec worker celery -A worker.celery_app:celery_app worker --loglevel=INFO --pool=solo --concurrency=1

beat:
docker compose -f $(COMPOSE_FILE) exec beat celery -A worker.celery_app:celery_app beat --loglevel=INFO

reindex:
docker compose -f $(COMPOSE_FILE) exec api python /workspace/scripts/reindex_embeddings.py
