#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

docker compose --env-file .env.prod \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml \
  down "$@"
