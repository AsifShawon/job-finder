#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env.prod ]; then
  echo "Missing .env.prod. Create it first:"
  echo "  cp .env.prod.example .env.prod"
  exit 1
fi

warn_if_unsafe() {
  if grep -Eq '^POSTGRES_PASSWORD=(ooi|password|REPLACE_)' .env.prod; then
    echo "WARNING: POSTGRES_PASSWORD still looks like a default or placeholder."
  fi
  if grep -Eq '^MINIO_ROOT_USER=minioadmin|^MINIO_ROOT_PASSWORD=minioadmin|^MINIO_ROOT_USER=REPLACE_|^MINIO_ROOT_PASSWORD=REPLACE_' .env.prod; then
    echo "WARNING: MinIO root credentials still look like defaults or placeholders."
  fi
  if grep -Eq '^NEXT_PUBLIC_API_BASE_URL=https?://(localhost|127\.0\.0\.1)' .env.prod; then
    echo "WARNING: NEXT_PUBLIC_API_BASE_URL points to localhost; use the public API domain."
  fi
  if grep -Eq '^SECRET_KEY=(change-me|local-dev|REPLACE_)' .env.prod; then
    echo "WARNING: SECRET_KEY still looks like a default or placeholder."
  fi
}

compose() {
  docker compose --env-file .env.prod \
    -f infrastructure/docker-compose.yml \
    -f infrastructure/docker-compose.prod.yml \
    "$@"
}

warn_if_unsafe
compose up -d --build postgres redis minio searxng
compose run --rm api alembic upgrade head
compose up -d --build --remove-orphans
compose ps
